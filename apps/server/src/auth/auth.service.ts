import { createHmac, timingSafeEqual } from 'node:crypto';

import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { type z } from 'zod';

import {
  AUTH_LIMITS,
  AUTH_TTL_MS,
  type CustomerUser,
  ErrorCode,
  type GuestDataCounts,
  type SignInRequestSchema,
  type SignUpRequestSchema,
  type SuspensionCategory,
} from '@sarwa/contracts';

import { AuditService } from '../admin/audit.service';
import { Clock } from '../common/clock';
import { PasswordHasher } from '../common/password-hasher';
import { RateLimitedException, RateLimiter } from '../common/rate-limiter';
import { env } from '../env';
import { PrismaService } from '../prisma.service';
import { AccountLifecycleService } from '../trading/account-lifecycle.service';
import { ExecutionQueue } from '../trading/execution-queue';
import { NotificationsService } from '../trading/notifications.service';
import { customerEntity, toCustomerUser, type UserWithAccount } from './customer-user';
import { Mailer } from './mailer';
import { OneTimeTokens } from './one-time-tokens.service';
import {
  type ClientContext,
  type IssuedSession,
  type Principal,
  SessionsService,
} from './sessions.service';

type SignUpInput = z.output<typeof SignUpRequestSchema>;
type SignInInput = z.output<typeof SignInRequestSchema>;

const HOUR_MS = 3_600_000;
const LOCK_MESSAGE = 'For your security we paused sign-in on this account for a few minutes.';

export interface SignedIn {
  session: IssuedSession;
  user: CustomerUser;
  claimed?: GuestDataCounts;
  deletionCanceled?: boolean;
}

const invalidCredentials = () =>
  new UnauthorizedException({
    code: ErrorCode.InvalidCredentials,
    message: 'Email or password is incorrect',
  });

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly hasher: PasswordHasher,
    private readonly sessions: SessionsService,
    private readonly limiter: RateLimiter,
    private readonly tokens: OneTimeTokens,
    private readonly mailer: Mailer,
    private readonly audit: AuditService,
    private readonly queue: ExecutionQueue,
    private readonly lifecycle: AccountLifecycleService,
    private readonly notifications: NotificationsService,
  ) {}

  // The account opens with the user, in one queued transaction, and takes over the device's
  // guest portfolio if there is one.
  async signUp(input: SignUpInput, client: ClientContext, deviceId?: string): Promise<SignedIn> {
    this.limiter.consume(`sign-up:${client.ip ?? ''}`, AUTH_LIMITS.signUpPerHour, HOUR_MS);
    if (await this.prisma.user.findUnique({ where: { email: input.email } })) throw emailInUse();

    const passwordHash = await this.hasher.hash(input.password);
    const now = new Date(this.clock.now());
    const { user, claimed } = await this.queue
      .run(() =>
        this.prisma.$transaction(async (tx) => {
          const created = await tx.user.create({
            data: {
              email: input.email,
              name: input.name,
              passwordHash,
              signupPlatform: client.platform,
              createdAt: now,
              lastActiveAt: now,
            },
          });
          const { account, claimed } = await this.lifecycle.attach(tx, created.id, deviceId);
          await this.audit.log(
            {
              actorEmail: input.email,
              action: 'customer.signup',
              entity: customerEntity(account.handle),
              payload: { platform: client.platform, ...(claimed && { claimed }) },
              ip: client.ip,
            },
            tx,
          );
          return { user: { ...created, account }, claimed };
        }),
      )
      .catch((error: unknown) => {
        const race =
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
        throw race ? emailInUse() : error;
      });

    await this.notifications.notify([user.account.id], { kind: 'welcome' });
    await this.sendVerification(user.id, user.email);
    const session = await this.sessions.start(user.id, input.keepSignedIn, client);
    return { session, user: toCustomerUser(user), ...(claimed && { claimed }) };
  }

  // Every failure answers the same, and the password check always runs, so neither the answer nor
  // its timing reveals which emails have an account.
  async signIn(input: SignInInput, client: ClientContext, deviceId?: string): Promise<SignedIn> {
    const now = this.clock.now();
    const ipKey = `sign-in:${client.ip ?? ''}`;
    this.limiter.assertAllowed(ipKey, AUTH_LIMITS.signInFailures, AUTH_LIMITS.signInWindowMs);

    const found = await this.prisma.user.findUnique({
      where: { email: input.email },
      include: { account: { select: { id: true, handle: true } } },
    });
    const user = found?.status === 'deleted' ? null : found;
    const valid = await this.hasher.verify(user?.passwordHash, input.password);
    const lockedFor = (user?.lockedUntil?.getTime() ?? 0) - now;
    if (lockedFor > 0) throw new RateLimitedException(lockedFor, LOCK_MESSAGE);
    if (!user || !valid) {
      await this.recordFailure(user, ipKey);
      throw invalidCredentials();
    }
    if (user.status === 'suspended') throw suspended(user);

    await this.settleGuestData(user.id, user.account?.id, input.guestTicket, deviceId);
    const deletionCanceled = user.deletionRequestedAt !== null;
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLogins: 0,
        lockedUntil: null,
        lastActiveAt: new Date(now),
        deletionRequestedAt: null,
      },
      include: { account: { select: { id: true, handle: true } } },
    });
    this.limiter.clear(accountKey(user.id));
    const session = await this.sessions.start(user.id, input.keepSignedIn, client);
    await this.audit.log({
      actorEmail: user.email,
      action: 'customer.signin',
      entity: customerEntity(updated.account?.handle ?? ''),
      payload: { platform: client.platform, ...(deletionCanceled && { deletionCanceled }) },
      ip: client.ip,
    });
    return {
      session,
      user: toCustomerUser(updated),
      ...(deletionCanceled && { deletionCanceled }),
    };
  }

  async refresh(refreshToken: string, client: ClientContext): Promise<SignedIn> {
    const session = await this.sessions.refresh(refreshToken, client);
    return { session, user: toCustomerUser(await this.user(session.userId)) };
  }

  async signOut(
    principal: Principal | undefined,
    refreshToken: string | undefined,
    ip?: string,
  ): Promise<void> {
    const target = principal ?? (refreshToken ? await this.sessions.familyOf(refreshToken) : null);
    if (!target) return;
    await this.sessions.revoke(target.userId, { only: [target.sessionId] }, 'signed_out');
    const user = await this.user(target.userId);
    await this.audit.log({
      actorEmail: user.email,
      action: 'customer.signout',
      entity: customerEntity(user.account?.handle ?? ''),
      ip,
    });
  }

  async sendVerification(userId: string, email: string): Promise<void> {
    const token = await this.tokens.issue('emailVerify', userId);
    await this.mailer.send({
      to: email,
      kind: 'verify_email',
      subject: 'Verify your email',
      link: `${env.WEB_URL}/verify-email?token=${token}`,
    });
  }

  user(userId: string): Promise<UserWithAccount> {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { account: { select: { id: true, handle: true } } },
    });
  }

  // A device's guest stars join the user's watchlist. A guest portfolio is never merged: the user
  // confirms dropping it with the ticket from the first attempt, or keeps it by not signing in.
  private async settleGuestData(
    userId: string,
    accountId: string | undefined,
    ticket: string | undefined,
    deviceId: string | undefined,
  ): Promise<void> {
    const guest = await this.lifecycle.guestData(deviceId);
    if (!guest || !deviceId) return;
    const { positions, openOrders, watchlist } = guest.counts;
    if (positions + openOrders === 0) {
      if (watchlist > 0 && accountId)
        await this.lifecycle.mergeWatchlist(guest.account.id, accountId);
      return;
    }
    // Guests can no longer trade, so only devices that traded before guest trading ended get here.
    if (!ticket || !this.ticketMatches(ticket, userId, deviceId)) {
      throw new ConflictException({
        code: ErrorCode.GuestDataPresent,
        message: "Signing in will replace this device's practice data",
        ticket: this.ticket(userId, deviceId, this.clock.now() + AUTH_TTL_MS.guestTicket),
        ...guest.counts,
      });
    }
    await this.lifecycle.discard(guest.account.id);
  }

  // `<expiry>.<signature>`: binds the confirmation to this user, this device and two minutes.
  private ticket(userId: string, deviceId: string, expiresAt: number): string {
    const signature = createHmac('sha256', env.JWT_SECRET)
      .update(`guest-ticket:${userId}:${deviceId}:${String(expiresAt)}`)
      .digest('base64url');
    return `${String(expiresAt)}.${signature}`;
  }

  private ticketMatches(ticket: string, userId: string, deviceId: string): boolean {
    const expiresAt = Number(ticket.split('.')[0]);
    if (!Number.isSafeInteger(expiresAt) || expiresAt <= this.clock.now()) return false;
    const expected = Buffer.from(this.ticket(userId, deviceId, expiresAt));
    const given = Buffer.from(ticket);
    return given.length === expected.length && timingSafeEqual(given, expected);
  }

  // Five failures in the window lock the account; the IP limit stops spraying many accounts.
  private async recordFailure(user: { id: string } | null, ipKey: string): Promise<void> {
    this.limiter.record(ipKey, AUTH_LIMITS.signInWindowMs);
    if (!user) return;
    const failures = this.limiter.record(accountKey(user.id), AUTH_LIMITS.signInWindowMs);
    const lock = failures >= AUTH_LIMITS.signInFailures;
    if (lock) this.limiter.clear(accountKey(user.id));
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLogins: { increment: 1 },
        ...(lock && { lockedUntil: new Date(this.clock.now() + AUTH_LIMITS.signInLockMs) }),
      },
    });
  }
}

const accountKey = (userId: string) => `sign-in-account:${userId}`;

const emailInUse = () =>
  new ConflictException({
    code: ErrorCode.EmailInUse,
    message: 'An account with this email already exists',
  });

export function suspended(user: UserWithAccount): ForbiddenException {
  return new ForbiddenException({
    code: ErrorCode.AccountSuspended,
    message: 'Your account is suspended',
    suspension: {
      reasonCategory: (user.suspensionCategory ?? 'other') as SuspensionCategory,
      reason: user.suspensionReason ?? '',
      at: user.suspendedAt?.getTime() ?? 0,
      accountHandle: user.account?.handle ?? '',
    },
  });
}
