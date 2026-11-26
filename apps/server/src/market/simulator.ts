/**
 * Pure price-simulation helpers (no Nest, no I/O) — easy to unit-test and to reason about.
 *
 * Prices follow geometric Brownian motion (GBM), the textbook model for stock prices:
 *   next = price × exp(σ·√dt·Z − ½σ²·dt),   Z ~ N(0, 1)
 * It never goes negative, and moves are proportional to price (a $500 stock moves more
 * dollars than a $25 one), which is what makes the simulated market feel real.
 */
import { type Candle, type Period } from '@sarwa/contracts';

export type Random = () => number;

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
/** Base annual volatility; multiplied by the stock's and the market's volatility settings. */
export const BASE_ANNUAL_VOLATILITY = 0.3;
/** Simulated time runs 60× faster than wall time so ticks are visible in a demo. */
export const TIME_SCALE = 60;

/** Deterministic PRNG (mulberry32) — same seed, same sequence. */
export function seededRandom(seed: number): Random {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a string hash → seed (e.g. "AAPL:1Y"). */
export function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Standard normal sample (Box–Muller). */
export function gaussian(random: Random): number {
  const u = Math.max(random(), Number.EPSILON);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
}

/** One GBM step. `sigma` is annualised volatility, `dtMs` the simulated time elapsed. */
export function nextPrice(price: number, sigma: number, dtMs: number, random: Random): number {
  const dt = dtMs / YEAR_MS;
  const next =
    price * Math.exp(sigma * Math.sqrt(dt) * gaussian(random) - 0.5 * sigma * sigma * dt);
  return roundPrice(next);
}

export function roundPrice(value: number): number {
  return Math.round(value * 100) / 100;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Candle resolution and count per chart period. */
export const CANDLE_SPECS: Record<Period, { stepMs: number; count: number }> = {
  '1D': { stepMs: 5 * MINUTE, count: 288 },
  '1W': { stepMs: HOUR, count: 168 },
  '1M': { stepMs: 4 * HOUR, count: 180 },
  '1Y': { stepMs: DAY, count: 365 },
  ALL: { stepMs: 7 * DAY, count: 260 },
};

/**
 * Deterministic history that ends exactly at the current price: we walk BACKWARDS from the
 * live price with a PRNG seeded by symbol+period, so the same chart comes back on every request
 * and the last candle always matches the price shown in the header.
 */
export function generateCandles(
  symbol: string,
  period: Period,
  currentPrice: number,
  sigma: number,
  now: number,
): Candle[] {
  const { stepMs, count } = CANDLE_SPECS[period];
  const random = seededRandom(hashSeed(`${symbol}:${period}`));
  const lastOpenTime = Math.floor(now / stepMs) * stepMs;
  const candles: Candle[] = [];

  let close = currentPrice;
  for (let i = 0; i < count; i++) {
    const open = nextPrice(close, sigma, stepMs, random); // stepping backwards in time
    const wick = close * sigma * Math.sqrt(stepMs / YEAR_MS) * random();
    candles.push({
      t: lastOpenTime - i * stepMs,
      o: open,
      h: roundPrice(Math.max(open, close) + wick),
      l: roundPrice(Math.max(0.01, Math.min(open, close) - wick)),
      c: close,
      v: Math.round(50_000 + random() * 950_000),
    });
    close = open;
  }
  return candles.reverse();
}
