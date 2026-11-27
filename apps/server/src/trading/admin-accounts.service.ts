import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { type z } from 'zod';

import {
  type AdminAccount,
  type AdminAccountsResponse,
  type AdminAccountsQuerySchema,
  type Account,
  resetConfirmation,
} from '@sarwa/contracts';
import { POLICY } from '@sarwa/domain';

import { type Actor, AuditService } from '../admin/audit.service';
import { Clock } from '../common/clock';
import { PrismaService } from '../prisma.service';
import { ExecutionQueue } from './execution-queue';
import { ExecutionService } from './execution.service';
import { toAccount, WORKING_STATUSES } from './mappers';
import { PortfolioService } from './portfolio.service';

type AccountsQuery = z.output<typeof AdminAccountsQuerySchema>;

const SORTS: Record<AccountsQuery['sort'], (a: AdminAccount, b: AdminAccount) => number> = {
  allTime: (a, b) => b.allTimeCents - a.allTimeCents,
  equity: (a, b) => b.equityCents - a.equityCents,
  lastTrade: (a, b) => (b.lastTradeAt ?? 0) - (a.lastTradeAt ?? 0),
};

@Injectable()
export class AdminAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly queue: ExecutionQueue,
    private readonly execution: ExecutionService,
    private readonly portfolio: PortfolioService,
    private readonly audit: AuditService,
  ) {}

  // Valued with live prices, so it's computed per account rather than sorted in SQL.
  async list(query: AccountsQuery): Promise<AdminAccountsResponse> {
    const q = query.q?.toUpperCase();
    const accounts = await this.prisma.account.findMany({
      where: q ? { handle: { contains: q } } : {},
      include: {
        _count: {
          select: { positions: true, orders: { where: { status: { in: [...WORKING_STATUSES] } } } },
        },
        fills: { orderBy: { at: 'desc' }, take: 1, select: { at: true } },
      },
    });
    const items = await Promise.all(
      accounts.map(async (account): Promise<AdminAccount> => {
        const summary = await this.portfolio.summary(account);
        return {
          id: account.id,
          handle: account.handle,
          createdAt: account.createdAt.getTime(),
          equityCents: summary.equityCents,
          cashCents: summary.cashCents,
          todayCents: summary.todayCents,
          allTimeCents: summary.allTimeCents,
          allTimeBps: summary.allTimeBps,
          positions: account._count.positions,
          openOrders: account._count.orders,
          lastTradeAt: account.fills[0]?.at.getTime() ?? null,
        };
      }),
    );
    items.sort(SORTS[query.sort]);
    const start = (query.page - 1) * query.pageSize;
    return {
      items: items.slice(start, start + query.pageSize),
      total: items.length,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  // Irreversible for the user, so it must be confirmed with the handle. History stays, under the old epoch.
  reset(accountId: string, confirm: string, actor: Actor): Promise<Account> {
    return this.queue.run(async () => {
      const account = await this.prisma.account.findUnique({ where: { id: accountId } });
      if (!account) throw new NotFoundException('Account not found');
      if (confirm !== resetConfirmation(account.handle)) {
        throw new UnprocessableEntityException({
          code: 'CONFIRMATION_MISMATCH',
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
      return toAccount(updated);
    });
  }
}
