import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';

import { AUDIT_PII_RETENTION_DAYS, AUDIT_RETENTION_DAYS, AUTH_TTL_MS } from '@sarwa/contracts';

import { AuditService } from '../admin/audit.service';
import { Clock, Ticker } from '../common/clock';
import { PrismaService } from '../prisma.service';
import { AccountLifecycleService } from '../trading/account-lifecycle.service';
import { customerEntity } from './customer-user';

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const AUDIT_IP_RETENTION_MS = AUDIT_PII_RETENTION_DAYS * DAY_MS;
const AUDIT_RETENTION_MS = AUDIT_RETENTION_DAYS * DAY_MS;
const ENDED_SESSION_RETENTION_MS = 30 * DAY_MS;

// Data minimization. Runs hourly so a restart never skips a day; each step is idempotent.
@Injectable()
export class RetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RetentionService.name);
  private stop?: () => void;

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly ticker: Ticker,
    private readonly lifecycle: AccountLifecycleService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit(): void {
    this.stop = this.ticker.every(HOUR_MS, () => {
      this.run().catch((error: unknown) => {
        this.logger.error(`Retention failed: ${String(error)}`);
      });
    });
  }

  onModuleDestroy(): void {
    this.stop?.();
  }

  async run(): Promise<void> {
    await this.purgeDeletedAccounts();
    await this.trimAuditLog();
    await this.pruneEndedSessions();
  }

  // Seven days after a deletion request: the email is freed, the profile anonymized and the
  // sessions gone. Orders, fills and the audit trail stay.
  async purgeDeletedAccounts(): Promise<number> {
    const due = await this.prisma.user.findMany({
      where: {
        status: { not: 'deleted' },
        deletionRequestedAt: { lte: new Date(this.clock.now() - AUTH_TTL_MS.deletionGrace) },
      },
      include: { account: { select: { id: true, handle: true } } },
    });
    for (const user of due) {
      if (user.account) await this.lifecycle.retire(user.account.id);
      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: user.id },
          data: {
            email: `deleted-${user.id}@deleted.invalid`,
            name: 'Deleted customer',
            passwordHash: '',
            status: 'deleted',
            lockedUntil: null,
          },
        });
        await tx.session.deleteMany({ where: { userId: user.id } });
        await tx.passwordResetToken.deleteMany({ where: { userId: user.id } });
        await tx.emailVerificationToken.deleteMany({ where: { userId: user.id } });
        await this.audit.log(
          {
            actorEmail: 'system',
            action: 'customer.deleted',
            entity: customerEntity(user.account?.handle ?? ''),
            payload: { requestedAt: user.deletionRequestedAt?.toISOString() },
          },
          tx,
        );
      });
    }
    return due.length;
  }

  // Audit events are kept 400 days; the address they came from only 90.
  async trimAuditLog(): Promise<{ anonymized: number; deleted: number }> {
    const now = this.clock.now();
    const [anonymized, deleted] = await this.prisma.$transaction([
      this.prisma.auditLog.updateMany({
        where: { createdAt: { lt: new Date(now - AUDIT_IP_RETENTION_MS) }, ip: { not: null } },
        data: { ip: null },
      }),
      this.prisma.auditLog.deleteMany({
        where: { createdAt: { lt: new Date(now - AUDIT_RETENTION_MS) } },
      }),
    ]);
    return { anonymized: anonymized.count, deleted: deleted.count };
  }

  // Rotated, revoked or expired refresh rows only matter for spotting a reused token.
  async pruneEndedSessions(): Promise<number> {
    const { count } = await this.prisma.session.deleteMany({
      where: {
        lastUsedAt: { lt: new Date(this.clock.now() - ENDED_SESSION_RETENTION_MS) },
        OR: [
          { rotatedAt: { not: null } },
          { revokedAt: { not: null } },
          { expiresAt: { lt: new Date(this.clock.now()) } },
        ],
      },
    });
    return count;
  }
}
