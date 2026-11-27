import { Injectable } from '@nestjs/common';
import { type Account as AccountRow } from '@prisma/client';

import { type CancelReason, type GuestDataCounts } from '@sarwa/contracts';

import { PrismaService, type Tx } from '../prisma.service';
import { AccountsService } from './accounts.service';
import { AlertsService } from './alerts.service';
import { ExecutionQueue } from './execution-queue';
import { ExecutionService } from './execution.service';
import { WORKING_STATUSES } from './mappers';
import { OrderBook } from './order-book';

// Moving accounts between owners: a guest's account becomes a user's, or is thrown away.
@Injectable()
export class AccountLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: ExecutionQueue,
    private readonly execution: ExecutionService,
    private readonly book: OrderBook,
    private readonly alerts: AlertsService,
    private readonly accounts: AccountsService,
  ) {}

  // The device's guest account and what it holds.
  async guestData(
    deviceId: string | undefined,
    tx: Tx = this.prisma,
  ): Promise<{ account: AccountRow; counts: GuestDataCounts } | null> {
    if (!deviceId) return null;
    const found = await tx.account.findFirst({
      where: { deviceId, userId: null },
      include: {
        _count: {
          select: {
            positions: true,
            watchlist: true,
            orders: { where: { status: { in: [...WORKING_STATUSES] } } },
          },
        },
      },
    });
    if (!found) return null;
    const { _count, ...account } = found;
    return {
      account,
      counts: {
        positions: _count.positions,
        openOrders: _count.orders,
        watchlist: _count.watchlist,
      },
    };
  }

  // Sign-up: the device's guest account becomes the new user's, or a fresh one is opened. The
  // caller runs this inside the execution queue and its own transaction.
  async attach(
    tx: Tx,
    userId: string,
    deviceId: string | undefined,
  ): Promise<{ account: AccountRow; claimed?: GuestDataCounts }> {
    const guest = await this.guestData(deviceId, tx);
    if (!guest) return { account: await this.accounts.open(tx, { userId }) };
    const account = await tx.account.update({
      where: { id: guest.account.id },
      data: { userId, deviceId: null },
    });
    return { account, claimed: guest.counts };
  }

  // Sign-in on a device whose guest account holds only stars: they join the user's, then it goes.
  mergeWatchlist(guestAccountId: string, accountId: string): Promise<void> {
    return this.queue.run(() =>
      this.prisma.$transaction(async (tx) => {
        const [stars, owned] = await Promise.all([
          tx.watchlistItem.findMany({ where: { accountId: guestAccountId } }),
          tx.watchlistItem.findMany({ where: { accountId }, select: { symbol: true } }),
        ]);
        const have = new Set(owned.map((item) => item.symbol));
        await tx.watchlistItem.createMany({
          data: stars
            .filter((star) => !have.has(star.symbol))
            .map((star) => ({ accountId, symbol: star.symbol })),
        });
        await tx.account.delete({ where: { id: guestAccountId } });
      }),
    );
  }

  // Sign-in on a device whose guest trading data the user agreed to drop: it is never merged.
  discard(accountId: string): Promise<void> {
    return this.queue.run(async () => {
      await this.stopTrading(accountId);
      await this.prisma.account.delete({ where: { id: accountId } });
    });
  }

  // A deleted customer's account keeps its trading history for the audit; what only served the
  // customer (working orders, alerts, watchlist, push tokens) goes.
  retire(accountId: string): Promise<void> {
    return this.queue.run(async () => {
      await this.stopTrading(accountId);
      await this.prisma.$transaction([
        this.prisma.alert.deleteMany({ where: { accountId } }),
        this.prisma.watchlistItem.deleteMany({ where: { accountId } }),
        this.prisma.pushToken.deleteMany({ where: { accountId } }),
      ]);
    });
  }

  // Suspension stops every working order, each with its own update and notice.
  cancelWorking(accountId: string, cancelReason: CancelReason): Promise<number> {
    return this.queue.run(async () => {
      const working = await this.prisma.order.findMany({
        where: { accountId, status: { in: [...WORKING_STATUSES] } },
      });
      for (const order of working) {
        const closed = await this.execution.close(order, 'canceled', { cancelReason });
        await this.execution.publish(closed, 'order_canceled');
      }
      return working.length;
    });
  }

  // Nobody is left to notify: working orders just close and alerts stop being evaluated.
  private async stopTrading(accountId: string): Promise<void> {
    const working = await this.prisma.order.findMany({
      where: { accountId, status: { in: [...WORKING_STATUSES] } },
    });
    for (const order of working) {
      this.book.sync(await this.execution.close(order, 'canceled', { cancelReason: 'user' }));
    }
    this.alerts.forget(accountId);
  }
}
