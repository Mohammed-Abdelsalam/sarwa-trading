import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { type Stock as StockRow } from '@prisma/client';
import { Subject } from 'rxjs';

import {
  MARKET_VOLATILITY,
  type MarketStatus,
  type Period,
  type Quote,
  type Stock,
  type StockStats,
  type StockWithQuote,
  TICK_MS,
} from '@sarwa/contracts';

import { PrismaService } from '../prisma.service';
import {
  BASE_ANNUAL_VOLATILITY,
  gaussian,
  generateCandles,
  nextPrice,
  type Random,
  roundPrice,
  TIME_SCALE,
} from './simulator';

interface Instrument {
  row: StockRow;
  quote: Quote;
}

/** Share of symbols that move on each tick — real markets don't move every symbol every 500 ms. */
const MOVE_PROBABILITY = 0.6;

/**
 * Owns the simulated market: the in-memory quote for every stock, the tick loop, and the
 * running/paused + volatility state. Other parts of the app subscribe to `quotes$`/`status$`
 * instead of calling each other, which keeps the gateway and the admin decoupled.
 */
@Injectable()
export class MarketService implements OnModuleInit, OnModuleDestroy {
  readonly quotes$ = new Subject<Quote[]>();
  readonly status$ = new Subject<MarketStatus>();

  private readonly logger = new Logger(MarketService.name);
  private instruments = new Map<string, Instrument>();
  private status: MarketStatus = {
    state: 'running',
    volatility: MARKET_VOLATILITY.default,
    since: Date.now(),
  };
  private timer?: NodeJS.Timeout;
  private ticksLastSecond = { second: 0, count: 0, rate: 0 };
  /** Replaceable in tests for deterministic ticks. */
  random: Random = Math.random;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.reload();
    this.timer = setInterval(() => {
      this.tick();
    }, TICK_MS);
    this.logger.log(`Simulating ${this.instruments.size} stocks every ${TICK_MS} ms`);
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
    this.quotes$.complete();
    this.status$.complete();
  }

  /** (Re)load the universe from the database, keeping live quotes of existing symbols. */
  async reload(): Promise<void> {
    const rows = await this.prisma.stock.findMany({ orderBy: { symbol: 'asc' } });
    const next = new Map<string, Instrument>();
    for (const row of rows) {
      const existing = this.instruments.get(row.symbol);
      next.set(row.symbol, { row, quote: existing?.quote ?? this.openingQuote(row) });
    }
    this.instruments = next;
  }

  /** One simulation step: move some enabled symbols and publish the ones that changed. */
  tick(now = Date.now()): Quote[] {
    if (this.status.state === 'paused') return [];
    const changed: Quote[] = [];
    for (const instrument of this.instruments.values()) {
      if (!instrument.row.isEnabled || this.random() > MOVE_PROBABILITY) continue;
      const { quote } = instrument;
      const price = nextPrice(
        quote.price,
        this.sigma(instrument.row),
        TICK_MS * TIME_SCALE,
        this.random,
      );
      if (price === quote.price) continue;
      instrument.quote = {
        ...quote,
        price,
        dayHigh: Math.max(quote.dayHigh, price),
        dayLow: Math.min(quote.dayLow, price),
        volume: quote.volume + Math.round(100 + this.random() * 5_000),
        ts: now,
        seq: quote.seq + 1,
      };
      changed.push(instrument.quote);
    }
    this.countTicks(now, changed.length);
    if (changed.length > 0) this.quotes$.next(changed);
    return changed;
  }

  // ── reads ────────────────────────────────────────────────────────────────

  listStocks(query?: string): StockWithQuote[] {
    const q = query?.trim().toLowerCase();
    return [...this.instruments.values()]
      .filter(({ row }) => row.isEnabled)
      .filter(
        ({ row }) =>
          !q || row.symbol.toLowerCase().includes(q) || row.name.toLowerCase().includes(q),
      )
      .map(({ row, quote }) => ({ ...toStock(row), quote }));
  }

  /** Enabled instrument or undefined (disabled stocks are invisible to clients). */
  find(symbol: string): { stock: Stock; quote: Quote } | undefined {
    const instrument = this.instruments.get(symbol);
    if (!instrument?.row.isEnabled) return undefined;
    return { stock: toStock(instrument.row), quote: instrument.quote };
  }

  getQuotes(symbols: string[]): Quote[] {
    return symbols.flatMap((symbol) => {
      const found = this.find(symbol);
      return found ? [found.quote] : [];
    });
  }

  /** Live price of any stock (enabled or not) — used by the admin table. */
  livePrice(symbol: string): number | null {
    return this.instruments.get(symbol)?.quote.price ?? null;
  }

  candles(symbol: string, period: Period) {
    const instrument = this.instruments.get(symbol);
    if (!instrument) return [];
    return generateCandles(
      symbol,
      period,
      instrument.quote.price,
      this.sigma(instrument.row),
      Date.now(),
    );
  }

  /** Key statistics, derived from the 1Y history so they always agree with the chart. */
  stats(symbol: string): StockStats | undefined {
    const instrument = this.instruments.get(symbol);
    if (!instrument) return undefined;
    const year = this.candles(symbol, '1Y');
    return {
      marketCap: instrument.row.marketCap,
      peRatio: instrument.row.peRatio,
      week52High: Math.max(...year.map((c) => c.h)),
      week52Low: Math.min(...year.map((c) => c.l)),
      avgVolume: Math.round(year.reduce((sum, c) => sum + c.v, 0) / year.length),
    };
  }

  getStatus(): MarketStatus {
    return this.status;
  }

  ticksPerSecond(): number {
    return this.ticksLastSecond.rate;
  }

  counts(): { enabled: number; total: number } {
    const all = [...this.instruments.values()];
    return { enabled: all.filter((i) => i.row.isEnabled).length, total: all.length };
  }

  // ── admin commands ───────────────────────────────────────────────────────

  pause(): MarketStatus {
    return this.setStatus({ state: 'paused' });
  }

  resume(): MarketStatus {
    return this.setStatus({ state: 'running' });
  }

  setVolatility(volatility: number): MarketStatus {
    return this.setStatus({ volatility });
  }

  // ── internals ────────────────────────────────────────────────────────────

  private setStatus(patch: Partial<MarketStatus>): MarketStatus {
    const stateChanged = patch.state !== undefined && patch.state !== this.status.state;
    this.status = {
      ...this.status,
      ...patch,
      since: stateChanged ? Date.now() : this.status.since,
    };
    this.status$.next(this.status);
    return this.status;
  }

  private sigma(row: StockRow): number {
    return BASE_ANNUAL_VOLATILITY * row.volatility * this.status.volatility;
  }

  private openingQuote(row: StockRow): Quote {
    const open = roundPrice(row.basePrice * (1 + gaussian(this.random) * 0.004));
    return {
      symbol: row.symbol,
      price: open,
      prevClose: row.basePrice,
      open,
      dayHigh: Math.max(open, row.basePrice),
      dayLow: Math.min(open, row.basePrice),
      volume: Math.round(1_000_000 + this.random() * 5_000_000),
      ts: Date.now(),
      seq: 0,
    };
  }

  private countTicks(now: number, count: number): void {
    const second = Math.floor(now / 1000);
    if (second !== this.ticksLastSecond.second) {
      this.ticksLastSecond = { second, count, rate: this.ticksLastSecond.count };
    } else {
      this.ticksLastSecond.count += count;
    }
  }
}

function toStock(row: StockRow): Stock {
  return {
    symbol: row.symbol,
    name: row.name,
    sector: row.sector as Stock['sector'],
    exchange: row.exchange as Stock['exchange'],
    currency: 'USD',
  };
}
