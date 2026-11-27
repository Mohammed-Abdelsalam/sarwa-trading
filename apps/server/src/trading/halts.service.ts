import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { type Halt as HaltRow } from '@prisma/client';
import { Subject } from 'rxjs';

import { type Halt } from '@sarwa/contracts';

import { Clock } from '../common/clock';
import { PrismaService, type Tx } from '../prisma.service';
import { CircuitBreaker } from './circuit-breaker';
import { ExecutionQueue } from './execution-queue';
import { toHalt, WORKING_STATUSES } from './mappers';
import { NotificationsService } from './notifications.service';
import { TradingGateway } from './trading.gateway';

export interface NewHalt {
  symbol: string;
  source: Halt['source'];
  message: string;
  resumesAt: number | null;
  createdBy: string | null;
}

interface ActiveHalt {
  row: HaltRow;
  timer?: NodeJS.Timeout;
}

// Halted symbols keep streaming prices but nothing fills or triggers until they resume.
@Injectable()
export class HaltsService implements OnModuleInit, OnModuleDestroy {
  readonly changes$ = new Subject<void>();

  private readonly logger = new Logger(HaltsService.name);
  private readonly active = new Map<string, ActiveHalt>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly queue: ExecutionQueue,
    private readonly gateway: TradingGateway,
    private readonly notifications: NotificationsService,
    private readonly breaker: CircuitBreaker,
  ) {}

  async onModuleInit(): Promise<void> {
    const rows = await this.prisma.halt.findMany({ where: { endedAt: null } });
    for (const row of rows) this.track(row);
  }

  onModuleDestroy(): void {
    for (const { timer } of this.active.values()) clearTimeout(timer);
    this.changes$.complete();
  }

  isHalted(symbol: string): boolean {
    return this.active.has(symbol);
  }

  list(): Halt[] {
    return [...this.active.values()].map(({ row }) => toHalt(row));
  }

  // Runs inside the execution queue; `audit` writes in the same transaction as the halt row.
  async halt(input: NewHalt, audit?: (tx: Tx, halt: Halt) => Promise<void>): Promise<Halt> {
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.halt.create({
        data: {
          symbol: input.symbol,
          source: input.source,
          message: input.message,
          since: new Date(this.clock.now()),
          resumesAt: input.resumesAt === null ? null : new Date(input.resumesAt),
          createdBy: input.createdBy,
        },
      });
      await audit?.(tx, toHalt(created));
      return created;
    });
    this.track(row);
    this.breaker.reset(row.symbol);
    const halt = toHalt(row);
    this.gateway.symbolHalted(halt);
    this.changes$.next();
    return halt;
  }

  async resume(symbol: string, audit?: (tx: Tx, halt: Halt) => Promise<void>): Promise<boolean> {
    const current = this.active.get(symbol);
    if (!current) return false;
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      await tx.halt.update({ where: { id: current.row.id }, data: { endedAt: new Date(now) } });
      await audit?.(tx, toHalt(current.row));
    });
    clearTimeout(current.timer);
    this.active.delete(symbol);
    this.breaker.reset(symbol);
    this.gateway.symbolResumed(symbol, now);
    this.changes$.next();
    return true;
  }

  // Everyone with a stake in the symbol: holders, accounts with working orders, and watchers.
  async affectedAccounts(symbol: string): Promise<{ accountIds: string[]; openOrders: number }> {
    const [positions, orders, watchers] = await Promise.all([
      this.prisma.position.findMany({ where: { symbol }, select: { accountId: true } }),
      this.prisma.order.findMany({
        where: { symbol, status: { in: [...WORKING_STATUSES] } },
        select: { accountId: true },
      }),
      this.prisma.account.findMany({
        where: { device: { watchlist: { some: { symbol } } } },
        select: { id: true },
      }),
    ]);
    const accountIds = new Set([
      ...positions.map((p) => p.accountId),
      ...orders.map((o) => o.accountId),
      ...watchers.map((w) => w.id),
    ]);
    return { accountIds: [...accountIds], openOrders: orders.length };
  }

  async notifyAffected(halt: Halt): Promise<void> {
    const { accountIds } = await this.affectedAccounts(halt.symbol);
    await this.notifications.notify(accountIds, {
      kind: 'symbol_halted',
      symbol: halt.symbol,
      message: halt.message,
      resumesAt: halt.resumesAt,
    });
  }

  private track(row: HaltRow): void {
    const delay = row.resumesAt === null ? null : row.resumesAt.getTime() - this.clock.now();
    const timer =
      delay === null
        ? undefined
        : setTimeout(
            () => {
              this.queue
                .run(() => this.resume(row.symbol))
                .catch((error: unknown) => {
                  this.logger.error(`Auto-resume of ${row.symbol} failed: ${String(error)}`);
                });
            },
            Math.max(0, delay),
          );
    this.active.set(row.symbol, { row, timer });
  }
}
