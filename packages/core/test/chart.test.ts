import { type Candle } from '@sarwa/contracts';

import { chartBaseline, chartGeometry, nearestPointIndex, withLiveQuote } from '../src/chart';

const candle = (t: number, c: number): Candle => ({ t, o: c, h: c + 1, l: c - 1, c, v: 1 });

describe('chartGeometry', () => {
  it('maps values across the full width with the highest value at the top', () => {
    const { line, points } = chartGeometry([1, 2, 3], 60, 26);
    expect(line).toBe('M0.0 24.0L30.0 13.0L60.0 2.0');
    expect(points.map((p) => p.value)).toEqual([1, 2, 3]);
  });

  it('closes the area path along the bottom edge', () => {
    expect(chartGeometry([1, 2], 10, 10).area.endsWith('L10 10L0 10Z')).toBe(true);
  });

  it('returns empty geometry when there are fewer than two values', () => {
    expect(chartGeometry([5], 60, 26)).toEqual({
      line: '',
      area: '',
      points: [],
      referenceY: null,
    });
  });

  it('keeps the reference value inside the vertical range', () => {
    const { referenceY, points } = chartGeometry([10, 11], 100, 50, 0, 5);
    expect(referenceY).toBe(50);
    expect(points.every((p) => p.y < 50)).toBe(true);
  });

  it('draws a flat series in the middle instead of dividing by zero', () => {
    expect(chartGeometry([3, 3], 10, 10).points.every((p) => Number.isFinite(p.y))).toBe(true);
  });
});

describe('nearestPointIndex', () => {
  const { points } = chartGeometry([1, 2, 3, 4, 5], 100, 50);

  it('snaps a touch position to the closest point and clamps at the edges', () => {
    expect(nearestPointIndex(points, 48)).toBe(2);
    expect(nearestPointIndex(points, -20)).toBe(0);
    expect(nearestPointIndex(points, 500)).toBe(4);
  });

  it('returns -1 when there is nothing to select', () => {
    expect(nearestPointIndex([], 10)).toBe(-1);
  });
});

describe('withLiveQuote', () => {
  it('moves the last close to the live price and widens its high', () => {
    const candles = [candle(1, 100), candle(2, 101)];

    const live = withLiveQuote(candles, { price: 105 });

    expect(live[0]).toBe(candles[0]);
    expect(live[1]).toMatchObject({ c: 105, h: 105, l: 100 });
  });

  it('returns the candles unchanged when there is no quote or no candles', () => {
    const candles = [candle(1, 100)];
    expect(withLiveQuote(candles, undefined)).toBe(candles);
    expect(withLiveQuote([], { price: 1 })).toEqual([]);
  });
});

describe('chartBaseline', () => {
  const candles = [candle(1, 90), candle(2, 95)];

  it('uses the previous close on 1D so the colour matches the day change', () => {
    expect(chartBaseline('1D', candles, { prevClose: 99 })).toBe(99);
  });

  it('uses the first close for longer periods', () => {
    expect(chartBaseline('1M', candles, { prevClose: 99 })).toBe(90);
  });

  it('is null when there is nothing to compare against', () => {
    expect(chartBaseline('1W', [], undefined)).toBeNull();
  });
});
