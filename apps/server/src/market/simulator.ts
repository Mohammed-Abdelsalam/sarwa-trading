import { type Candle, type Period } from '@sarwa/contracts';

export type Random = () => number;

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export const BASE_ANNUAL_VOLATILITY = 0.3;

// Simulated time runs 60× faster than wall time so ticks are visible in a demo.
export const TIME_SCALE = 60;

export function seededRandom(seed: number): Random {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function gaussian(random: Random): number {
  const u = Math.max(random(), Number.EPSILON);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
}

// Geometric Brownian motion: never negative, and moves are proportional to price.
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

export const CANDLE_SPECS: Record<Period, { stepMs: number; count: number }> = {
  '1D': { stepMs: 5 * MINUTE, count: 288 },
  '1W': { stepMs: HOUR, count: 168 },
  '1M': { stepMs: 4 * HOUR, count: 180 },
  '1Y': { stepMs: DAY, count: 365 },
  ALL: { stepMs: 7 * DAY, count: 260 },
};

// Walks backwards from the live price so the last candle always matches the header.
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
    const open = nextPrice(close, sigma, stepMs, random);
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
