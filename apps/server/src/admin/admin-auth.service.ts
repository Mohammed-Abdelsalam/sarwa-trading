import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { type AdminUser as AdminUserRow } from '@prisma/client';
import bcrypt from 'bcryptjs';

import { Clock } from '../common/clock';
import { PrismaService } from '../prisma.service';
import { AuditService } from './audit.service';
import { ADMIN_AUDIENCE, type AdminToken, REMEMBER_TTL_SECONDS, SESSION_TTL_SECONDS } from './auth';

const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);
const MAX_FAILED_LOGINS = 5;
const LOCK_MS = 15 * 60_000;

export interface SignedIn {
  user: AdminUserRow;
  token: string;
  ttlSeconds: number;
}

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    private readonly clock: Clock,
  ) {}

  // Unknown emails, wrong passwords, disabled and locked accounts all get the same answer, and
  // bcrypt always runs, so neither the message nor the timing reveals which emails exist.
  async signIn(email: string, password: string, remember: boolean, ip?: string): Promise<SignedIn> {
    const now = this.clock.now();
    const user = await this.prisma.adminUser.findUnique({ where: { email } });
    const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    const locked = (user?.lockedUntil?.getTime() ?? 0) > now;
    if (!user || !valid || locked || user.status !== 'active') {
      await this.recordFailure(email, locked ? null : user, now, ip);
      throw new UnauthorizedException('Invalid email or password');
    }

    const updated = await this.prisma.adminUser.update({
      where: { id: user.id },
      data: { lastActiveAt: new Date(now), failedLogins: 0, lockedUntil: null },
    });
    const ttlSeconds = remember ? REMEMBER_TTL_SECONDS : SESSION_TTL_SECONDS;
    const claims: AdminToken = { sub: user.id, ver: user.tokenVersion };
    const token = await this.jwt.signAsync(claims, {
      expiresIn: ttlSeconds,
      audience: ADMIN_AUDIENCE,
    });
    await this.audit.log({ actorEmail: user.email, action: 'auth.login', entity: 'Session', ip });
    return { user: updated, token, ttlSeconds };
  }

  // Ends every session of this admin: tokens carry the version they were issued with.
  async signOut(token: string | undefined, ip?: string): Promise<void> {
    if (!token) return;
    let claims: AdminToken;
    try {
      claims = await this.jwt.verifyAsync<AdminToken>(token, { audience: ADMIN_AUDIENCE });
    } catch {
      return;
    }
    const user = await this.prisma.adminUser.update({
      where: { id: claims.sub },
      data: { tokenVersion: { increment: 1 } },
    });
    await this.audit.log({ actorEmail: user.email, action: 'auth.logout', entity: 'Session', ip });
  }

  // A locked account is not counted again, so an attacker can't keep extending the lock.
  private async recordFailure(
    email: string,
    user: AdminUserRow | null,
    now: number,
    ip?: string,
  ): Promise<void> {
    if (user) {
      const failures = user.failedLogins + 1;
      const lock = failures >= MAX_FAILED_LOGINS;
      await this.prisma.adminUser.update({
        where: { id: user.id },
        data: {
          failedLogins: lock ? 0 : failures,
          ...(lock && { lockedUntil: new Date(now + LOCK_MS) }),
        },
      });
    }
    await this.audit.log({ actorEmail: email, action: 'auth.login_failed', entity: 'Session', ip });
  }
}
