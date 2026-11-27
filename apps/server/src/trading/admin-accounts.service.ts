import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

import { type Account, ErrorCode, resetConfirmation } from '@sarwa/contracts';
import { POLICY } from '@sarwa/domain';

import { type Actor, AuditService } from '../admin/audit.service';
import { Clock } from '../common/clock';
import { EventBus } from '../common/events';
import { PrismaService } from '../prisma.service';
import { ExecutionQueue } from './execution-queue';
import { ExecutionService } from './execution.service';
import { toAccount, WORKING_STATUSES } from './mappers';

@Injectable()
export class AdminAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly queue: ExecutionQueue,
    private readonly execution: ExecutionService,
    private readonly audit: AuditService,
    private readonly events: EventBus,
  ) {}

  // Irreversible for the user, so it must be confirmed with the handle. History stays, under the old
  // epoch. `context` (who asked, and why) is kept in the audit entry.
  reset(
    accountId: string,
    confirm: string,
    actor: Actor,
    context: Record<string, unknown> = {},
  ): Promise<Account> {
    return this.queue.run(async () => {
      const account = await this.prisma.account.findUnique({ where: { id: accountId } });
      if (!account) throw new NotFoundException('Account not found');
      if (confirm !== resetConfirmation(account.handle)) {
        throw new UnprocessableEntityException({
          code: ErrorCode.ConfirmationMismatch,
          message: `Type "${resetConfirmation(account.handle)}" to confirm`,
        });
      }

      const now = new Date(this.clock.now());
      const { updated, canceled } = await this.prisma.$transaction(async (tx) => {
        const [working, positions] = await Promise.all([
          tx.order.findMany({
            where: { accountId, status: { in: [...WORKING_STATUSES] } },
          }),
          tx.position.findMany({ where: { accountId } }),
        ]);
        const closed = [];
        for (const order of working) {
          closed.push(
            await this.execution.close(order, 'canceled', { cancelReason: 'admin_reset' }, tx),
          );
        }
        await tx.position.deleteMany({ where: { accountId } });
        const next = await tx.account.update({
          where: { id: accountId },
          data: {
            cashCents: BigInt(POLICY.startingCashCents),
            epoch: { increment: 1 },
            resetAt: now,
          },
        });
        await this.audit.log(
          {
            actorEmail: actor.email,
            action: 'account.reset',
            entity: `Account · ${account.handle}`,
            payload: {
              ...context,
              before: {
                cashCents: Number(account.cashCents),
                epoch: account.epoch,
                positions: positions.map((p) => ({
                  symbol: p.symbol,
                  qtyMicros: Number(p.qtyMicros),
                  costBasisCents: Number(p.costBasisCents),
                })),
                workingOrders: working.map((order) => order.id),
              },
              after: { cashCents: Number(next.cashCents), epoch: next.epoch, positions: [] },
            },
            ip: actor.ip,
          },
          tx,
        );
        return { updated: next, canceled: closed };
      });

      for (const order of canceled) await this.execution.publish(order, 'order_canceled');
      this.events.publish({
        type: 'account.reset',
        account: { accountId, handle: account.handle },
      });
      return toAccount(updated);
    });
  }
}
