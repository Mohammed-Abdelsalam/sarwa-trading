import { z } from 'zod';

import { EXCHANGES, MARKET_VOLATILITY, PERIODS, SECTORS } from './constants';

/**
 * Domain model.
 * `Stock` is static metadata (fetched once); `Quote` is the fast-changing price (streamed).
 * Keeping them apart is a performance decision: the list renders from Stock, and only the
 * row whose Quote changed re-renders.
 */

export const SymbolSchema = z
  .string()
  .regex(/^[A-Z][A-Z.]{0,9}$/, 'Symbol must be 1–10 uppercase letters (dots allowed), e.g. AAPL');

export const SectorSchema = z.enum(SECTORS);
export const ExchangeSchema = z.enum(EXCHANGES);
export const PeriodSchema = z.enum(PERIODS);

export const StockSchema = z.object({
  symbol: SymbolSchema,
  name: z.string().min(1).max(80),
  sector: SectorSchema,
  exchange: ExchangeSchema,
  currency: z.literal('USD'),
});

/**
 * A price snapshot. `change` and `%` are derived on the client from `prevClose`
 * (never sent, so they can't disagree with the price).
 * `seq` increases per symbol; clients drop any quote whose seq is not newer than what they
 * have — that is how out-of-order ticks after a reconnect are ignored.
 */
export const QuoteSchema = z.object({
  symbol: SymbolSchema,
  price: z.number().positive(),
  prevClose: z.number().positive(),
  open: z.number().positive(),
  dayHigh: z.number().positive(),
  dayLow: z.number().positive(),
  volume: z.number().int().nonnegative(),
  /** server time, epoch milliseconds */
  ts: z.number().int().nonnegative(),
  seq: z.number().int().nonnegative(),
});

export const StockWithQuoteSchema = StockSchema.extend({ quote: QuoteSchema });

export const StockStatsSchema = z.object({
  marketCap: z.number().nonnegative(),
  /** null for loss-making companies (shown as "—") */
  peRatio: z.number().positive().nullable(),
  week52High: z.number().positive(),
  week52Low: z.number().positive(),
  avgVolume: z.number().int().nonnegative(),
});

/** OHLCV candle; `t` is the candle open time in epoch milliseconds. */
export const CandleSchema = z.object({
  t: z.number().int().nonnegative(),
  o: z.number().positive(),
  h: z.number().positive(),
  l: z.number().positive(),
  c: z.number().positive(),
  v: z.number().int().nonnegative(),
});

export const MarketStateSchema = z.enum(['running', 'paused']);

export const MarketStatusSchema = z.object({
  state: MarketStateSchema,
  volatility: z.number().min(MARKET_VOLATILITY.min).max(MARKET_VOLATILITY.max),
  /** epoch ms of the last state change (shown as "Since 11:02 AM" / "Paused … 4 min ago") */
  since: z.number().int().nonnegative(),
});

export type Symbol = z.infer<typeof SymbolSchema>;
export type Sector = z.infer<typeof SectorSchema>;
export type Exchange = z.infer<typeof ExchangeSchema>;
export type Period = z.infer<typeof PeriodSchema>;
export type Stock = z.infer<typeof StockSchema>;
export type Quote = z.infer<typeof QuoteSchema>;
export type StockWithQuote = z.infer<typeof StockWithQuoteSchema>;
export type StockStats = z.infer<typeof StockStatsSchema>;
export type Candle = z.infer<typeof CandleSchema>;
export type MarketState = z.infer<typeof MarketStateSchema>;
export type MarketStatus = z.infer<typeof MarketStatusSchema>;
