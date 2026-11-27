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
  type StocksChangedEvent,
  type StockWithQuote,
  TICK_MS,
} from '@sarwa/contracts';
import {
  dollarsToTicks,
  type MarketDate,
  marketClock,
  marketSession,
  spreadAround,
  ticks,
  ticksToDollars,
} from '@sarwa/domain';

import { Clock } from '../common/clock';
import { PrismaService } from '../prisma.service';
import { TradingConfigService } from '../trading-config/trading-config.service';
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

type LastTrade = Omit<Quote, 'bid' | 'ask' | 'bidSize' | 'askSize'>;

const MOVE_PROBABILITY = 0.6;
const OVERNIGHT_GAP_SD = 0.01;
const PERSIST_MS = 5_000;
const MIN_PRICE = 0.01;

@Injectable()
export class MarketService implements OnModuleInit, OnModuleDestroy {
  readonly quotes$ = new Subject<Quote[]>();
  readonly status$ = new Subject<MarketStatus>();
  readonly stocksChanged$ = new Subject<StocksChangedEvent>();

  private readonly logger = new Logger(MarketService.name);
  private instruments = new Map<string, Instrument>();
  private status!: MarketStatus;
  private timer?: NodeJS.Timeout;
  private persistTimer?: NodeJS.Timeout;
  private ticksLastSecond = { second: 0, count: 0, rate: 0 };
  // The New York date of the current trading day; a new date rolls the day over.
  private tradingDate: MarketDate | null = null;
  private readonly unsaved = new Set<string>();

  random: Random = Math.random;

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly tradingConfig: TradingConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const now = this.clock.now();
    this.status = { state: 'running', volatility: MARKET_VOLATILITY.default, since: now };
    const saved = await this.prisma.stock.findFirst({
      where: { tradingDate: { not: null } },
      orderBy: { tradingDate: 'desc' },
      select: { tradingDate: true },
    });
    // A saved day from before the restart rolls over on the first tick if the date has moved on.
    this.tradingDate =
      saved?.tradingDate ??
      (marketSession(now, this.tradingConfig.get().sessionMode).isOpen
        ? marketClock(now).date
        : null);
    await this.reload();
    this.timer = setInterval(() => {
      this.tick();
    }, TICK_MS);
    this.persistTimer = setInterval(() => {
      void this.persistPrices();
    }, PERSIST_MS);
    this.logger.log(`Simulating ${this.instruments.size} stocks every ${TICK_MS} ms`);
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
    clearInterval(this.persistTimer);
    this.quotes$.complete();
    this.status$.complete();
    this.stocksChanged$.complete();
  }

  async reload(): Promise<void> {
    const rows = await this.prisma.stock.findMany({ orderBy: { symbol: 'asc' } });
    const next = new Map<string, Instrument>();
    for (const row of rows) {
      const existing = this.instruments.get(row.symbol);
      next.set(row.symbol, { row, quote: existing?.quote ?? this.openingQuote(row) });
    }
    this.instruments = next;
    this.stocksChanged$.next({ at: this.clock.now() });
  }

  tick(now = this.clock.now()): Quote[] {
    if (this.status.state === 'paused') return [];
    const { sessionMode } = this.tradingConfig.get();
    if (!marketSession(now, sessionMode).isOpen) return [];
    const date = marketClock(now).date;
    if (date !== this.tradingDate) {
      this.tradingDate = date;
      return this.emit(this.rollover(sessionMode === 'calendar', now), now);
    }

    const changed: Quote[] = [];
    for (const instrument of this.instruments.values()) {
      if (!instrument.row.isEnabled || this.random() > MOVE_PROBABILITY) continue;
      const { quote } = instrument;
      const price = Math.max(
        MIN_PRICE,
        nextPrice(quote.price, this.sigma(instrument.row), TICK_MS * TIME_SCALE, this.random),
      );
      if (price === quote.price) continue;
      changed.push(this.trade(instrument, price, now));
    }
    return this.emit(changed, now);
  }

  // One print at `price`: every price change goes through here so the book, the day range and
  // persistence stay consistent.
  movePrice(symbol: string, price: number, now = this.clock.now()): Quote | undefined {
    const instrument = this.instruments.get(symbol);
    if (!instrument) return undefined;
    return this.emit([this.trade(instrument, roundPrice(price), now)], now)[0];
  }

  listStocks(query?: string): StockWithQuote[] {
    const q = query?.trim().toLowerCase();
    return [...this.instruments.values()]
      .filter(({ row }) => row.isEnabled)
      .filter(
        ({ row }) =>
          !q || row.symbol.toLowerCase().includes(q) || row.name.toLowerCase().includes(q),
      )
      .map(({ row, quote }) => ({
        ...toStock(row),
        quote,
        sparkline: this.sparkline(row.symbol),
        marketCap: row.marketCap,
      }));
  }

  // Every 12th 5-minute close of the 1D chart: one point per hour for the list rows.
  private sparkline(symbol: string): number[] {
    const candles = this.candles(symbol, '1D');
    return candles.filter((_, i) => i % 12 === 0 || i === candles.length - 1).map((c) => c.c);
  }

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

  livePrice(symbol: string): number | null {
    return this.instruments.get(symbol)?.quote.price ?? null;
  }

  // Valuation also needs disabled stocks: a position doesn't vanish when trading in it stops.
  quoteOf(symbol: string): Quote | undefined {
    return this.instruments.get(symbol)?.quote;
  }

  sectorOf(symbol: string): Stock['sector'] {
    return (this.instruments.get(symbol)?.row.sector ?? 'tech') as Stock['sector'];
  }

  candles(symbol: string, period: Period) {
    const instrument = this.instruments.get(symbol);
    if (!instrument) return [];
    return generateCandles(
      symbol,
      period,
      instrument.quote.price,
      this.sigma(instrument.row),
      this.clock.now(),
    );
  }

  // Derived from the 1Y candles so the stats always agree with the chart.
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

  isPaused(): boolean {
    return this.status.state === 'paused';
  }

  ticksPerSecond(): number {
    return this.ticksLastSecond.rate;
  }

  counts(): { enabled: number; total: number } {
    const all = [...this.instruments.values()];
    return { enabled: all.filter((i) => i.row.isEnabled).length, total: all.length };
  }

  pause(): MarketStatus {
    return this.setStatus({ state: 'paused' });
  }

  resume(): MarketStatus {
    return this.setStatus({ state: 'running' });
  }

  setVolatility(volatility: number): MarketStatus {
    return this.setStatus({ volatility });
  }

  async persistPrices(): Promise<void> {
    const symbols = [...this.unsaved];
    this.unsaved.clear();
    const updates = symbols.flatMap((symbol) => {
      const quote = this.instruments.get(symbol)?.quote;
      if (!quote) return [];
      // Raw SQL so the admin's "last edited" (@updatedAt) isn't bumped by every price move.
      return [
        this.prisma.$executeRaw`UPDATE "Stock" SET
          "lastTicks" = ${dollarsToTicks(quote.price)},
          "prevCloseTicks" = ${dollarsToTicks(quote.prevClose)},
          "openTicks" = ${dollarsToTicks(quote.open)},
          "dayHighTicks" = ${dollarsToTicks(quote.dayHigh)},
          "dayLowTicks" = ${dollarsToTicks(quote.dayLow)},
          "tradingDate" = ${this.tradingDate}
          WHERE "symbol" = ${symbol}`,
      ];
    });
    if (updates.length === 0) return;
    try {
      await this.prisma.$transaction(updates);
    } catch (error) {
      for (const symbol of symbols) this.unsaved.add(symbol);
      this.logger.warn(`Could not persist prices: ${String(error)}`);
    }
  }

  private setStatus(patch: Partial<MarketStatus>): MarketStatus {
    const stateChanged = patch.state !== undefined && patch.state !== this.status.state;
    this.status = {
      ...this.status,
      ...patch,
      since: stateChanged ? this.clock.now() : this.status.since,
    };
    this.status$.next(this.status);
    return this.status;
  }

  private emit(changed: Quote[], now: number): Quote[] {
    this.countTicks(now, changed.length);
    if (changed.length > 0) this.quotes$.next(changed);
    return changed;
  }

  private trade(instrument: Instrument, price: number, now: number): Quote {
    const { quote } = instrument;
    instrument.quote = this.withBook({
      ...quote,
      price,
      dayHigh: Math.max(quote.dayHigh, price),
      dayLow: Math.min(quote.dayLow, price),
      volume: quote.volume + Math.round(100 + this.random() * 5_000),
      ts: now,
      seq: quote.seq + 1,
    });
    this.unsaved.add(instrument.row.symbol);
    return instrument.quote;
  }

  // A new trading day: the last price becomes the close, and in calendar mode the open gaps
  // from it the way overnight news moves a stock.
  private rollover(gap: boolean, now: number): Quote[] {
    const changed: Quote[] = [];
    for (const instrument of this.instruments.values()) {
      const close = instrument.quote.price;
      const open = gap
        ? Math.max(
            MIN_PRICE,
            roundPrice(close * Math.exp(OVERNIGHT_GAP_SD * gaussian(this.random))),
          )
        : close;
      instrument.quote = this.withBook({
        ...instrument.quote,
        price: open,
        prevClose: close,
        open,
        dayHigh: open,
        dayLow: open,
        volume: 0,
        ts: now,
        seq: instrument.quote.seq + 1,
      });
      this.unsaved.add(instrument.row.symbol);
      if (instrument.row.isEnabled) changed.push(instrument.quote);
    }
    return changed;
  }

  // Simulated top of book: the configured spread around the last trade and random lots shown.
  private withBook(trade: LastTrade): Quote {
    const { bidTicks, askTicks } = spreadAround(
      dollarsToTicks(trade.price),
      this.tradingConfig.get().rules.spreadBps,
    );
    return {
      ...trade,
      bid: ticksToDollars(bidTicks),
      ask: ticksToDollars(askTicks),
      bidSize: this.displayedSize(),
      askSize: this.displayedSize(),
    };
  }

  private displayedSize(): number {
    return (1 + Math.floor(this.random() * 9)) * 100;
  }

  private sigma(row: StockRow): number {
    return BASE_ANNUAL_VOLATILITY * row.volatility * this.status.volatility;
  }

  // Restores the saved day after a restart; a stock never priced before starts near its base price.
  private openingQuote(row: StockRow): Quote {
    const last =
      dollars(row.lastTicks) ?? roundPrice(row.basePrice * (1 + gaussian(this.random) * 0.004));
    const prevClose = dollars(row.prevCloseTicks) ?? row.basePrice;
    return this.withBook({
      symbol: row.symbol,
      price: last,
      prevClose,
      open: dollars(row.openTicks) ?? last,
      dayHigh: Math.max(last, dollars(row.dayHighTicks) ?? prevClose),
      dayLow: Math.min(last, dollars(row.dayLowTicks) ?? prevClose),
      volume: Math.round(1_000_000 + this.random() * 5_000_000),
      ts: this.clock.now(),
      seq: 0,
    });
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

const dollars = (price: bigint | null): number | null =>
  price === null ? null : ticksToDollars(ticks(Number(price)));

function toStock(row: StockRow): Stock {
  return {
    symbol: row.symbol,
    name: row.name,
    sector: row.sector as Stock['sector'],
    exchange: row.exchange as Stock['exchange'],
    currency: 'USD',
  };
}
