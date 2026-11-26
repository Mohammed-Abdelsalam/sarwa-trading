import { PERIODS } from '@sarwa/contracts';

import { CANDLE_SPECS, generateCandles, hashSeed, nextPrice, seededRandom } from './simulator';

describe('seededRandom', () => {
  it('returns the same sequence for the same seed', () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('stays within [0, 1)', () => {
    const random = seededRandom(hashSeed('AAPL'));
    for (let i = 0; i < 1000; i++) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('nextPrice', () => {
  it('never goes negative, even with extreme volatility', () => {
    const random = seededRandom(1);
    let price = 1;
    for (let i = 0; i < 10_000; i++)
      price = Math.max(nextPrice(price, 5, 86_400_000, random), 0.01);
    expect(price).toBeGreaterThan(0);
  });

  it('rounds to cents', () => {
    const price = nextPrice(231.48, 0.3, 30_000, seededRandom(7));
    expect(Math.round(price * 100) / 100).toBe(price);
  });

  it('keeps the price unchanged when volatility is zero', () => {
    expect(nextPrice(100, 0, 30_000, seededRandom(3))).toBe(100);
  });
});

describe('generateCandles', () => {
  const now = Date.UTC(2026, 10, 26, 14, 41);

  it.each(PERIODS)('returns the configured number of %s candles in time order', (period) => {
    const candles = generateCandles('AAPL', period, 231.48, 0.3, now);
    expect(candles).toHaveLength(CANDLE_SPECS[period].count);
    for (let i = 1; i < candles.length; i++) {
      expect(candles[i]!.t - candles[i - 1]!.t).toBe(CANDLE_SPECS[period].stepMs);
    }
  });

  it('ends exactly at the current price so the chart matches the header', () => {
    const candles = generateCandles('AAPL', '1D', 231.48, 0.3, now);
    expect(candles.at(-1)?.c).toBe(231.48);
  });

  it('is deterministic for the same symbol and period', () => {
    expect(generateCandles('TSLA', '1M', 248.35, 0.5, now)).toEqual(
      generateCandles('TSLA', '1M', 248.35, 0.5, now),
    );
  });

  it('produces valid OHLC candles (high ≥ open/close ≥ low > 0)', () => {
    for (const c of generateCandles('NVDA', '1Y', 142.87, 0.6, now)) {
      expect(c.h).toBeGreaterThanOrEqual(Math.max(c.o, c.c));
      expect(c.l).toBeLessThanOrEqual(Math.min(c.o, c.c));
      expect(c.l).toBeGreaterThan(0);
    }
  });
});
