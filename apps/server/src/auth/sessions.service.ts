import { randomUUID } from 'node:crypto';

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { type Session as SessionRow } from '@prisma/client';
import UAParser from 'ua-parser-js';

import {
  AUTH_TTL_MS,
  type ClientPlatform,
  ErrorCode,
  type SessionInfo,
  type SessionRevokedReason,
  type Suspension,
} from '@sarwa/contracts';

import { Clock } from '../common/clock';
import { EventBus } from '../common/events';
import { maskIp } from '../common/pii';
import { PrismaService, type Tx } from '../prisma.service';
import { newSecret, sha256 } from './secrets';

export const CUSTOMER_AUDIENCE = 'customer';
// Two tabs refreshing at once both send the same cookie; the loser of that race is not a thief.
const REUSE_GRACE_MS = 10_000;

export interface ClientContext {
  platform: ClientPlatform;
  ip?: string | undefined;
  userAgent?: string | undefined;
  deviceModel?: string | undefined;
}

export interface Principal {
  userId: string;
  accountId: string;
  sessionId: string;
}

export type SessionSelection = { only: readonly string[] } | { except: string } | { all: true };

export interface IssuedSession {
  sessionId: string;
  userId: string;
  accessToken: string;
  accessExpiresAt: number;
  refreshToken: string;
  refreshExpiresAt: number;
}

interface AccessClaims {
  sub: string;
  sid: string;
}

const PLATFORM_APP: Record<Exclude<ClientPlatform, 'web'>, string> = {
  ios: 'Mini Trading for iOS',
  android: 'Mini Trading for Android',
};

export const sessionRevoked = (message = 'Your session ended, sign in again') =>
  new UnauthorizedException({ code: ErrorCode.SessionRevoked, message });

// A session is a family of refresh-token rows: the familyId is its public id and the access
// token's `sid`. Only the newest row of a live family is unrotated and unrevoked.
@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly clock: Clock,
    private readonly events: EventBus,
  ) {}

  async start(
    userId: string,
    keepSignedIn: boolean,
    client: ClientContext,
    tx: Tx = this.prisma,
  ): Promise<IssuedSession> {
    const now = this.clock.now();
    const familyId = randomUUID();
    const refreshToken = newSecret();
    const row = await tx.session.create({
      data: {
        familyId,
        userId,
        refreshHash: sha256(refreshToken),
        keepSignedIn,
        ...describe(client),
        createdAt: new Date(now),
        lastUsedAt: new Date(now),
        expiresAt: new Date(now + refreshTtl(keepSignedIn)),
      },
    });
    return this.issue(row, refreshToken);
  }

  // Rotates the refresh token. Presenting a rotated one again means it leaked: the family ends.
  async refresh(refreshToken: string, client: ClientContext): Promise<IssuedSession> {
    const now = this.clock.now();
    const presented = await this.prisma.session.findUnique({
      where: { refreshHash: sha256(refreshToken) },
      include: { user: { select: { status: true, deletionRequestedAt: true } } },
    });
    if (!presented) throw new UnauthorizedException('Sign in required');
    if (presented.revokedAt || presented.expiresAt.getTime() <= now) throw sessionRevoked();
    if (presented.user.status !== 'active' || presented.user.deletionRequestedAt) {
      throw sessionRevoked();
    }

    let current: SessionRow | null = presented;
    if (presented.rotatedAt) {
      const raced = now - presented.rotatedAt.getTime() <= REUSE_GRACE_MS;
      current = raced ? await this.live(presented.familyId) : null;
      if (!current) {
        await this.revoke(presented.userId, { only: [presented.familyId] }, 'revoked');
        throw sessionRevoked();
      }
    }

    const next = newSecret();
    const { familyId, userId, keepSignedIn, label, platform, browser, os, model, createdAt } =
      current;
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.session.update({ where: { id: current.id }, data: { rotatedAt: new Date(now) } });
      await tx.user.update({ where: { id: userId }, data: { lastActiveAt: new Date(now) } });
      return tx.session.create({
        data: {
          familyId,
          userId,
          refreshHash: sha256(next),
          keepSignedIn,
          label,
          platform,
          browser,
          os,
          model,
          ip: client.ip ?? null,
          ipMasked: client.ip ? maskIp(client.ip) : '',
          createdAt,
          lastUsedAt: new Date(now),
          expiresAt: new Date(now + refreshTtl(keepSignedIn)),
        },
      });
    });
    return this.issue(row, next);
  }

  async authenticate(accessToken: string): Promise<Principal> {
    let claims: AccessClaims;
    try {
      claims = await this.jwt.verifyAsync<AccessClaims>(accessToken, {
        audience: CUSTOMER_AUDIENCE,
      });
    } catch {
      throw new UnauthorizedException('Session expired, sign in again');
    }
    const row = await this.prisma.session.findFirst({
      where: { ...this.liveWhere(), familyId: claims.sid, userId: claims.sub },
      select: { user: { select: { status: true, account: { select: { id: true } } } } },
    });
    const accountId = row?.user.account?.id;
    if (row?.user.status !== 'active' || !accountId) throw sessionRevoked();
    return { userId: claims.sub, accountId, sessionId: claims.sid };
  }

  // The family a refresh token belongs to, for signing out without a valid access token.
  async familyOf(refreshToken: string): Promise<{ userId: string; sessionId: string } | null> {
    const row = await this.prisma.session.findUnique({
      where: { refreshHash: sha256(refreshToken) },
      select: { userId: true, familyId: true },
    });
    return row && { userId: row.userId, sessionId: row.familyId };
  }

  async list(userId: string, currentId?: string): Promise<SessionInfo[]> {
    const rows = await this.prisma.session.findMany({
      where: { ...this.liveWhere(), userId },
      orderBy: { lastUsedAt: 'desc' },
    });
    return rows.map((row) => ({ ...toSessionInfo(row), current: row.familyId === currentId }));
  }

  // Ends the chosen live sessions of this user, tells their open sockets and returns their labels.
  async revoke(
    userId: string,
    which: SessionSelection,
    reason: SessionRevokedReason,
    suspension?: Suspension,
  ): Promise<string[]> {
    const rows = await this.prisma.session.findMany({
      where: {
        ...this.liveWhere(),
        userId,
        ...('only' in which && { familyId: { in: [...which.only] } }),
        ...('except' in which && { familyId: { not: which.except } }),
      },
      select: { familyId: true, label: true },
    });
    const families = [...new Set(rows.map((row) => row.familyId))];
    if (families.length === 0) return [];
    await this.prisma.session.updateMany({
      where: { userId, familyId: { in: families }, revokedAt: null },
      data: { revokedAt: new Date(this.clock.now()) },
    });
    this.events.publish({
      type: 'session.revoked',
      userId,
      sessionIds: families,
      reason,
      ...(suspension && { suspension }),
    });
    return rows.map((row) => row.label);
  }

  private live(familyId: string): Promise<SessionRow | null> {
    return this.prisma.session.findFirst({ where: { ...this.liveWhere(), familyId } });
  }

  private liveWhere() {
    return liveSession(this.clock.now());
  }

  private async issue(row: SessionRow, refreshToken: string): Promise<IssuedSession> {
    const claims: AccessClaims = { sub: row.userId, sid: row.familyId };
    const accessToken = await this.jwt.signAsync(claims, {
      audience: CUSTOMER_AUDIENCE,
      expiresIn: AUTH_TTL_MS.access / 1000,
    });
    return {
      sessionId: row.familyId,
      userId: row.userId,
      accessToken,
      accessExpiresAt: this.clock.now() + AUTH_TTL_MS.access,
      refreshToken,
      refreshExpiresAt: row.expiresAt.getTime(),
    };
  }
}

// The newest row of a family that is still signed in.
export const liveSession = (now: number) => ({
  rotatedAt: null,
  revokedAt: null,
  expiresAt: { gt: new Date(now) },
});

const refreshTtl = (keepSignedIn: boolean): number =>
  keepSignedIn ? AUTH_TTL_MS.refreshKeepSignedIn : AUTH_TTL_MS.refresh;

// "Chrome on macOS" on the web; the app name and the phone model the app sends on mobile.
function describe(client: ClientContext) {
  const ip = client.ip ?? null;
  const base = { platform: client.platform, ip, ipMasked: ip ? maskIp(ip) : '' };
  if (client.platform !== 'web') {
    const model = client.deviceModel ?? null;
    const app = PLATFORM_APP[client.platform];
    return { ...base, model, label: model ? `${app} · ${model}` : app };
  }
  const parsed = new UAParser(client.userAgent ?? '').getResult();
  const browser = parsed.browser.name ?? null;
  // ua-parser still says "Mac OS"; people know it as macOS.
  const os = parsed.os.name === 'Mac OS' ? 'macOS' : (parsed.os.name ?? null);
  const label = browser && os ? `${browser} on ${os}` : (browser ?? os ?? 'Web browser');
  return { ...base, browser, os, label };
}

export function toSessionInfo(row: SessionRow): Omit<SessionInfo, 'current'> {
  return {
    id: row.familyId,
    label: row.label,
    platform: row.platform as ClientPlatform,
    ...(row.browser && { browser: row.browser }),
    ...(row.os && { os: row.os }),
    ...(row.model && { model: row.model }),
    ipMasked: row.ipMasked,
    lastActiveAt: row.lastUsedAt.getTime(),
    createdAt: row.createdAt.getTime(),
  };
}
