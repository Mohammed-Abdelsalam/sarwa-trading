import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import {
  type Account,
  AUTH_TTL_MS,
  type CustomerUser,
  type DeleteAccountResponse,
  ErrorCode,
  type MeSummary,
  resetConfirmation,
  type RevokeOthersResponse,
  type SessionInfo,
} from '@sarwa/contracts';

import { AuditService } from '../admin/audit.service';
import { Clock } from '../common/clock';
import { PasswordHasher } from '../common/password-hasher';
import { PrismaService } from '../prisma.service';
import { AdminAccountsService } from '../trading/admin-accounts.service';
import { WORKING_STATUSES } from '../trading/mappers';
import { PortfolioService } from '../trading/portfolio.service';
import { AuthService } from './auth.service';
import { customerEntity, toCustomerUser } from './customer-user';
import { RecoveryService } from './recovery.service';
import { type Principal, SessionsService } from './sessions.service';

export const invalidCurrentPassword = () =>
  new BadRequestException({
    code: ErrorCode.InvalidCurrentPassword,
    message: 'Current password is incorrect',
  });

// The signed-in customer's own profile, password and sessions.
@Injectable()
export class MeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly hasher: PasswordHasher,
    private readonly sessions: SessionsService,
    private readonly portfolio: PortfolioService,
    private readonly auth: AuthService,
    private readonly recovery: RecoveryService,
    private readonly accounts: AdminAccountsService,
    private readonly audit: AuditService,
  ) {}

  async me({ userId }: Principal): Promise<CustomerUser> {
    return toCustomerUser(await this.auth.user(userId));
  }

  async rename({ userId }: Principal, name: string): Promise<CustomerUser> {
    await this.prisma.user.update({ where: { id: userId }, data: { name } });
    return toCustomerUser(await this.auth.user(userId));
  }

  async summary({ accountId }: Principal): Promise<MeSummary> {
    const [summary, openOrders, watchlist, alerts] = await Promise.all([
      this.portfolio.summary(accountId),
      this.prisma.order.count({ where: { accountId, status: { in: [...WORKING_STATUSES] } } }),
      this.prisma.watchlistItem.count({ where: { accountId } }),
      this.prisma.alert.count({ where: { accountId } }),
    ]);
    return { equityCents: summary.equityCents, openOrders, watchlist, alerts };
  }

  // Signs out every other device; this one stays signed in.
  async changePassword(
    principal: Principal,
    current: string,
    next: string,
  ): Promise<{ sessionsRevoked: number }> {
    await this.assertPassword(principal.userId, current);
    await this.recovery.setPassword(principal.userId, next);
    const revoked = await this.sessions.revoke(
      principal.userId,
      { except: principal.sessionId },
      'password_changed',
    );
    const { email } = await this.auth.user(principal.userId);
    await this.recovery.notifyPasswordChanged(email);
    return { sessionsRevoked: revoked.length };
  }

  async assertPassword(userId: string, password: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await this.hasher.verify(user.passwordHash, password))) throw invalidCurrentPassword();
  }

  // Takes effect after a 7-day grace: signing in before then cancels it.
  async requestDeletion(
    { userId }: Principal,
    password: string,
    ip?: string,
  ): Promise<DeleteAccountResponse> {
    await this.assertPassword(userId, password);
    const now = this.clock.now();
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { deletionRequestedAt: new Date(now) },
      include: { account: { select: { handle: true } } },
    });
    await this.sessions.revoke(userId, { all: true }, 'deleted');
    const purgeAt = now + AUTH_TTL_MS.deletionGrace;
    await this.audit.log({
      actorEmail: user.email,
      action: 'customer.delete_requested',
      entity: customerEntity(user.account?.handle ?? ''),
      payload: { purgeAt: new Date(purgeAt).toISOString() },
      ip,
    });
    return { purgeAt };
  }

  // The admin reset, confirmed by the customer typing RESET instead of the handle.
  async resetPaperAccount({ userId, accountId }: Principal, ip?: string): Promise<Account> {
    const user = await this.auth.user(userId);
    const handle = user.account?.handle ?? '';
    return this.accounts.reset(
      accountId,
      resetConfirmation(handle),
      { email: user.email, ip },
      { actor: 'customer' },
    );
  }

  sessionsOf({ userId, sessionId }: Principal): Promise<SessionInfo[]> {
    return this.sessions.list(userId, sessionId);
  }

  async signOutSession({ userId, sessionId }: Principal, id: string): Promise<void> {
    if (id === sessionId) {
      throw new BadRequestException('Use sign out to end the session on this device');
    }
    const ended = await this.sessions.revoke(userId, { only: [id] }, 'revoked');
    if (ended.length === 0) throw new NotFoundException('Session not found');
  }

  async signOutOthers({ userId, sessionId }: Principal): Promise<RevokeOthersResponse> {
    const labels = await this.sessions.revoke(userId, { except: sessionId }, 'revoked');
    return { revoked: labels.length, labels };
  }
}
