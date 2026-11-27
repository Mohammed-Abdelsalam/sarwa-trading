import { Injectable } from '@nestjs/common';
import { type z } from 'zod';

import {
  AUTH_LIMITS,
  type ResetPasswordRequestSchema,
  type VerifyEmailResponse,
} from '@sarwa/contracts';

import { AuditService } from '../admin/audit.service';
import { Clock } from '../common/clock';
import { PasswordHasher } from '../common/password-hasher';
import { RateLimiter } from '../common/rate-limiter';
import { env } from '../env';
import { PrismaService } from '../prisma.service';
import { AuthService, type SignedIn, suspended } from './auth.service';
import { customerEntity, toCustomerUser } from './customer-user';
import { Mailer } from './mailer';
import { OneTimeTokens } from './one-time-tokens.service';
import { type ClientContext, SessionsService } from './sessions.service';

type ResetInput = z.output<typeof ResetPasswordRequestSchema>;

const HOUR_MS = 3_600_000;

// Emailed links: password reset and email verification. Every answer is the same whether or not
// the email has an account.
@Injectable()
export class RecoveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly hasher: PasswordHasher,
    private readonly sessions: SessionsService,
    private readonly limiter: RateLimiter,
    private readonly tokens: OneTimeTokens,
    private readonly mailer: Mailer,
    private readonly audit: AuditService,
    private readonly auth: AuthService,
  ) {}

  async forgot(email: string, ip?: string): Promise<void> {
    this.limiter.consume(`forgot:${email}`, AUTH_LIMITS.forgotPerHour, HOUR_MS);
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { account: { select: { handle: true } } },
    });
    if (user?.status !== 'active') return;
    await this.sendReset(user.id, user.email);
    await this.audit.log({
      actorEmail: user.email,
      action: 'customer.reset_password_sent',
      entity: customerEntity(user.account?.handle ?? ''),
      payload: { requestedBy: 'customer' },
      ip,
    });
  }

  async sendReset(userId: string, email: string): Promise<void> {
    const token = await this.tokens.issue('passwordReset', userId);
    await this.mailer.send({
      to: email,
      kind: 'password_reset',
      subject: 'Reset your password',
      link: `${env.WEB_URL}/reset-password?token=${token}`,
    });
  }

  async resetInfo(token: string): Promise<{ email: string }> {
    const { email } = await this.tokens.peek('passwordReset', token);
    return { email };
  }

  // A new password ends every session and signs this device in.
  async reset(
    input: ResetInput,
    client: ClientContext,
  ): Promise<SignedIn & { sessionsRevoked: number }> {
    const { userId } = await this.tokens.consume('passwordReset', input.token);
    const user = await this.auth.user(userId);
    if (user.status === 'suspended') throw suspended(user);
    await this.setPassword(userId, input.password);
    const revoked = await this.sessions.revoke(userId, { all: true }, 'password_changed');
    await this.notifyPasswordChanged(user.email);
    const session = await this.sessions.start(userId, input.keepSignedIn, client);
    return {
      session,
      user: toCustomerUser(await this.auth.user(userId)),
      sessionsRevoked: revoked.length,
    };
  }

  async setPassword(userId: string, password: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await this.hasher.hash(password),
        passwordChangedAt: new Date(this.clock.now()),
        failedLogins: 0,
        lockedUntil: null,
      },
    });
  }

  async notifyPasswordChanged(email: string): Promise<void> {
    await this.mailer.send({
      to: email,
      kind: 'password_changed',
      subject: 'Your password was changed',
    });
  }

  async verify(token: string): Promise<VerifyEmailResponse> {
    const { userId, email } = await this.tokens.consume('emailVerify', token);
    await this.prisma.user.updateMany({
      where: { id: userId, emailVerifiedAt: null },
      data: { emailVerifiedAt: new Date(this.clock.now()) },
    });
    return { email };
  }

  // Once a minute per address, whether or not it has an account.
  async resendVerification(email: string): Promise<void> {
    this.limiter.consume(`resend:${email}`, 1, AUTH_LIMITS.resendCooldownMs);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user?.status !== 'active' || user.emailVerifiedAt) return;
    await this.auth.sendVerification(user.id, user.email);
  }
}
