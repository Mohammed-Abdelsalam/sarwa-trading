import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { type Subscription } from 'rxjs';

import { type Quote } from '@sarwa/contracts';
import { MARKET_TIME_ZONE, marketClock, marketSession, micros } from '@sarwa/domain';

import { Clock, Ticker } from '../common/clock';
import { MarketService } from '../market/market.service';
import { PrismaService } from '../prisma.service';
import { TradingConfigService } from '../trading-config/trading-config.service';
import { AlertsService } from './alerts.service';
import { CircuitBreaker } from './circuit-breaker';
import { ExecutionQueue } from './execution-queue';
import { ExecutionService } from './execution.service';
import { HaltsService } from './halts.service';
import { toTradeQuote, WORKING_STATUSES } from './mappers';
import { NotificationsService } from './notifications.service';
import { OrderBook } from './order-book';
import { StatusService } from './status.service';

const HOUSEKEEPING_MS = 1_000;

const closeTime = new Intl.DateTimeFormat('en-US', {
  timeZone: MARKET_TIME_ZONE,
  hour: 'numeric',
  minute: '2-digit',
});

// Drives the book from the market: quotes, session open/close and expiry all run through the
// execution queue like every other change to orders and accounts.
@Injectable()
export class TradingEngine implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TradingEngine.name);
  // Only the latest quote per symbol matters: a burst of ticks becomes one processing task.
  private readonly pending = new Map<string, Quote>();
  private quotesQueued = false;
  private housekeepingQueued = false;
  private subscription?: Subscription;
  private stopHousekeeping?: () => void;
  private wasOpen = false;
  private loaded = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly ticker: Ticker,
    private readonly queue: ExecutionQueue,
    private readonly market: MarketService,
    private readonly config: TradingConfigService,
    private readonly book: OrderBook,
    private readonly execution: ExecutionService,
    private readonly halts: HaltsService,
    private readonly breaker: CircuitBreaker,
    private readonly alerts: AlertsService,
    private readonly notifications: NotificationsService,
    private readonly status: StatusService,
  ) {}

  async onModuleInit(): Promise<void> {
    const working = await this.prisma.order.findMany({
      where: { status: { in: [...WORKING_STATUSES] } },
      select: { id: true, symbol: true, status: true },
    });
    for (const row of working) this.book.sync(row);
    this.wasOpen = this.session().isOpen;
    // Orders that expired while the server was down close before the first quote can reach them.
    await this.queue.run(() => this.housekeeping());
    this.subscription = this.market.quotes$.subscribe((quotes) => {
      this.enqueue(quotes);
    });
    this.subscription.add(
      this.market.disabled$.subscribe((symbols) => {
        this.queue
          .run(() => this.cancelDisabled(symbols))
          .catch((error: unknown) => {
            this.logger.error(`Canceling orders on disabled symbols failed: ${String(error)}`);
          });
      }),
    );
    this.stopHousekeeping = this.ticker.every(HOUSEKEEPING_MS, () => {
      this.scheduleHousekeeping();
    });
    this.loaded = true;
    this.logger.log(`Loaded ${this.book.size()} working orders`);
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  // Stops taking new work, then lets queued fills finish before the database disconnects.
  async onModuleDestroy(): Promise<void> {
    this.subscription?.unsubscribe();
    this.stopHousekeeping?.();
    await this.queue.idle();
  }

  // Resolves after everything queued so far (including pending quotes) has been processed.
  idle(): Promise<void> {
    return this.queue.idle();
  }

  scheduleHousekeeping(): void {
    if (this.housekeepingQueued) return;
    this.housekeepingQueued = true;
    this.queue
      .run(() => {
        this.housekeepingQueued = false;
        return this.housekeeping();
      })
      .catch((error: unknown) => {
        this.logger.error(`Housekeeping failed: ${String(error)}`);
      });
  }

  private enqueue(quotes: Quote[]): void {
    for (const quote of quotes) this.pending.set(quote.symbol, quote);
    if (this.quotesQueued) return;
    this.quotesQueued = true;
    this.queue
      .run(() => {
        this.quotesQueued = false;
        const batch = [...this.pending.values()];
        this.pending.clear();
        return this.processQuotes(batch);
      })
      .catch((error: unknown) => {
        this.logger.error(`Quote processing failed: ${String(error)}`);
      });
  }

  private async processQuotes(quotes: Quote[]): Promise<void> {
    const now = this.clock.now();
    const settings = this.config.get();
    const tradable = !this.market.isPaused() && this.session().isOpen;
    for (const quote of quotes) {
      const tradeQuote = toTradeQuote(quote);
      await this.alerts.evaluate(quote.symbol, tradeQuote, now);
      if (this.halts.isHalted(quote.symbol)) continue;

      const tripped = this.breaker.check(
        quote.symbol,
        tradeQuote.lastTicks,
        now,
        settings.circuitBreaker,
      );
      if (tripped) {
        const halt = await this.halts.halt({
          symbol: quote.symbol,
          source: 'circuit_breaker',
          message: tripped,
          resumesAt: now + settings.circuitBreaker.haltMs,
          createdBy: null,
        });
        await this.halts.notifyAffected(halt);
        continue;
      }
      if (!tradable) continue;

      const ids = this.book.ids(quote.symbol);
      if (ids.length === 0) continue;
      // Housekeeping may not have expired these yet, so an expired order is never worked.
      const orders = await this.prisma.order.findMany({
        where: {
          id: { in: ids },
          status: { in: [...WORKING_STATUSES] },
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date(now) } }],
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });
      // Time priority: the oldest order takes the displayed size first; later ones share the rest.
      let { askSizeMicros, bidSizeMicros } = tradeQuote;
      for (const order of orders) {
        const filled = await this.execution.work(order, {
          ...tradeQuote,
          askSizeMicros,
          bidSizeMicros,
        });
        if (order.side === 'buy') askSizeMicros = micros(Math.max(0, askSizeMicros - filled));
        else bidSizeMicros = micros(Math.max(0, bidSizeMicros - filled));
      }
    }
  }

  private async housekeeping(): Promise<void> {
    const now = this.clock.now();
    const session = this.session();
    if (session.isOpen !== this.wasOpen) {
      this.wasOpen = session.isOpen;
      this.status.publish();
      if (session.isOpen && session.earlyClose) await this.announceEarlyClose(session.closesAt);
    }

    const expired = await this.prisma.order.findMany({
      where: { status: { in: [...WORKING_STATUSES] }, expiresAt: { lte: new Date(now) } },
    });
    for (const row of expired) {
      const closed = await this.execution.close(row, 'expired');
      await this.execution.publish(closed, 'order_expired');
    }
  }

  // A disabled symbol has no quotes, so its orders would hold cash or shares until they expire.
  private async cancelDisabled(symbols: string[]): Promise<void> {
    const rows = await this.prisma.order.findMany({
      where: { symbol: { in: symbols }, status: { in: [...WORKING_STATUSES] } },
    });
    for (const row of rows) {
      const closed = await this.execution.close(row, 'canceled', {
        cancelReason: 'symbol_disabled',
      });
      await this.execution.publish(closed, 'order_canceled');
    }
  }

  private async announceEarlyClose(closesAt: number): Promise<void> {
    const accounts = await this.prisma.account.findMany({ select: { id: true } });
    this.notifications.enqueue(
      accounts.map((account) => account.id),
      {
        kind: 'market_notice',
        message: `Markets close early today (${marketClock(closesAt).date}) at ${closeTime.format(closesAt)} ET`,
      },
    );
  }

  private session() {
    return marketSession(this.clock.now(), this.config.get().sessionMode);
  }
}
