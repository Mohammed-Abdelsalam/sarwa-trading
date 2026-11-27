import { Injectable } from '@nestjs/common';
import { type z } from 'zod';

import {
  type AdminOrderStats,
  type AdminOrdersQuerySchema,
  type AdminOrdersResponse,
  type RejectionWire,
} from '@sarwa/contracts';
import { marketClock, marketTime, ORDER_TYPES, ratioBps } from '@sarwa/domain';

import { Clock } from '../common/clock';
import { PrismaService } from '../prisma.service';
import { toOrder } from './mappers';

type OrdersQuery = z.output<typeof AdminOrdersQuerySchema>;

@Injectable()
export class AdminOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  async list(query: OrdersQuery): Promise<AdminOrdersResponse> {
    const rows = await this.prisma.order.findMany({
      where: query.status ? { status: query.status } : {},
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit,
      include: { fills: true, account: { select: { handle: true } } },
    });
    return {
      items: rows.map((row) => ({
        ...toOrder(row),
        accountHandle: row.account.handle,
        latencyMs: row.latencyMs,
      })),
    };
  }

  // Today in New York, the exchange's day.
  async stats(): Promise<AdminOrderStats> {
    const since = new Date(marketTime(marketClock(this.clock.now()).date, 0));
    const today = { createdAt: { gte: since } };
    // Counted in the database: a busy day must not load every order into memory.
    const [groups, rejected, traders, amountOrders, notional] = await Promise.all([
      this.prisma.order.groupBy({ by: ['status', 'type'], where: today, _count: { _all: true } }),
      this.prisma.order.findMany({
        where: { ...today, status: 'rejected' },
        select: { rejection: true },
      }),
      this.prisma.order.groupBy({ by: ['accountId'], where: today }),
      this.prisma.order.count({ where: { ...today, amountCents: { not: null } } }),
      this.prisma.fill.aggregate({ _sum: { notionalCents: true }, where: { at: { gte: since } } }),
    ]);
    const total = (predicate: (group: (typeof groups)[number]) => boolean) =>
      groups.filter(predicate).reduce((sum, group) => sum + group._count._all, 0);
    const ordersToday = total(() => true);
    const reasons = new Map<RejectionWire['code'], number>();
    for (const { rejection } of rejected) {
      if (!rejection) continue;
      const { code } = JSON.parse(rejection) as RejectionWire;
      reasons.set(code, (reasons.get(code) ?? 0) + 1);
    }
    return {
      ordersToday,
      fillRateBps: ratioBps(
        total((g) => g.status === 'filled'),
        ordersToday,
      ),
      rejectedBps: ratioBps(
        total((g) => g.status === 'rejected'),
        ordersToday,
      ),
      notionalTodayCents: Number(notional._sum.notionalCents ?? 0n),
      activeTraders: traders.length,
      rejectionsByReason: [...reasons]
        .map(([code, count]) => ({ code, count }))
        .sort((a, b) => b.count - a.count),
      typeMix: ORDER_TYPES.map((type) => ({ type, count: total((g) => g.type === type) })),
      amountOrders,
    };
  }
}
