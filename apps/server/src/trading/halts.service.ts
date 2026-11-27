import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { type Halt as HaltRow } from '@prisma/client';
import { Subject } from 'rxjs';

import { type CreateHalt, type Halt, type HaltDuration, type HaltImpact } from '@sarwa/contracts';
import { marketSession } from '@sarwa/domain';

import { type Actor, AuditService } from '../admin/audit.service';
import { Clock } from '../common/clock';
import { EventBus } from '../common/events';
import { MarketService } from '../market/market.service';
import { PrismaService, type Tx } from '../prisma.service';
import { TradingConfigService } from '../trading-config/trading-config.service';
import { CircuitBreaker } from './circuit-breaker';
import { ExecutionQueue } from './execution-queue';
import { toHalt, WORKING_STATUSES } from './mappers';
import { NotificationsService } from './notifications.service';

export interface NewHalt {
  symbol: string;
  source: Halt['source'];
  message: string;
  resumesAt: number | null;
  createdBy: string | null;
}

const MINUTE_MS = 60_000;
// A timed halt that runs out is resumed by the system, not by whoever created it.
const SYSTEM: Actor = { email: 'system' };

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
    private readonly events: EventBus,
    private readonly notifications: NotificationsService,
    private readonly breaker: CircuitBreaker,
    private readonly audit: AuditService,
    private readonly market: MarketService,
    private readonly config: TradingConfigService,
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
    this.events.publish({ type: 'symbol.halted', halt });
    this.changes$.next();
    return halt;
  }

  adminHalt(input: CreateHalt, actor: Actor): Promise<Halt> {
    if (!this.market.quoteOf(input.symbol)) {
      throw new NotFoundException(`Unknown symbol ${input.symbol}`);
    }
    return this.queue.run(async () => {
      if (this.isHalted(input.symbol)) {
        throw new ConflictException(`${input.symbol} is already halted`);
      }
      const halt = await this.halt(
        {
          symbol: input.symbol,
          source: 'admin',
          message: input.message,
          resumesAt: this.resumesAt(input.duration),
          createdBy: actor.email,
        },
        (tx, created) =>
          this.audit.log(
            {
              actorEmail: actor.email,
              action: 'halt.create',
              entity: `Halt · ${input.symbol}`,
              payload: { before: null, after: { ...created, notify: input.notify } },
              ip: actor.ip,
            },
            tx,
          ),
      );
      if (input.notify) await this.notifyAffected(halt);
      return halt;
    });
  }

  adminResume(symbol: string, actor: Actor): Promise<void> {
    return this.queue.run(async () => {
      if (!(await this.resume(symbol, actor))) {
        throw new NotFoundException(`${symbol} is not halted`);
      }
    });
  }

  // Runs inside the execution queue; the audit row commits with the end of the halt.
  async resume(symbol: string, actor: Actor): Promise<boolean> {
    const current = this.active.get(symbol);
    if (!current) return false;
    const now = this.clock.now();
    await this.prisma.$transaction(async (tx) => {
      await tx.halt.update({ where: { id: current.row.id }, data: { endedAt: new Date(now) } });
      await this.audit.log(
        {
          actorEmail: actor.email,
          action: 'halt.resume',
          entity: `Halt · ${symbol}`,
          payload: { before: toHalt(current.row), after: null },
          ip: actor.ip,
        },
        tx,
      );
    });
    clearTimeout(current.timer);
    this.active.delete(symbol);
    this.breaker.reset(symbol);
    this.events.publish({ type: 'symbol.resumed', symbol, at: now });
    this.changes$.next();
    return true;
  }

  // Everyone with a stake in the symbol: holders, accounts with working orders, and customers
  // watching it.
  async affectedAccounts(symbol: string): Promise<{ accountIds: string[]; openOrders: number }> {
    const [positions, orders, watchers] = await Promise.all([
      this.prisma.position.findMany({ where: { symbol }, select: { accountId: true } }),
      this.prisma.order.findMany({
        where: { symbol, status: { in: [...WORKING_STATUSES] } },
        select: { accountId: true },
      }),
      this.prisma.account.findMany({
        where: { userId: { not: null }, watchlist: { some: { symbol } } },
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

  async impact(symbol: string): Promise<HaltImpact> {
    const { accountIds, openOrders } = await this.affectedAccounts(symbol);
    return { symbol, openOrders, holdersAndWatchers: accountIds.length };
  }

  async notifyAffected(halt: Halt): Promise<void> {
    const { accountIds } = await this.affectedAccounts(halt.symbol);
    this.notifications.enqueue(accountIds, {
      kind: 'symbol_halted',
      symbol: halt.symbol,
      message: halt.message,
      resumesAt: halt.resumesAt,
    });
  }

  private resumesAt(duration: HaltDuration): number | null {
    const now = this.clock.now();
    switch (duration) {
      case '5m':
        return now + 5 * MINUTE_MS;
      case '15m':
        return now + 15 * MINUTE_MS;
      case 'until_close':
        return marketSession(now, this.config.get().sessionMode).closesAt;
      case 'manual':
        return null;
    }
  }

  private track(row: HaltRow): void {
    const delay = row.resumesAt === null ? null : row.resumesAt.getTime() - this.clock.now();
    const timer =
      delay === null
        ? undefined
        : setTimeout(
            () => {
              this.queue
                .run(() => this.resume(row.symbol, SYSTEM))
                .catch((error: unknown) => {
                  this.logger.error(`Auto-resume of ${row.symbol} failed: ${String(error)}`);
                });
            },
            Math.max(0, delay),
          );
    this.active.set(row.symbol, { row, timer });
  }
}
