import { type Candle } from '@sarwa/contracts';

import {
  axisCandles,
  axisTicks,
  candleGeometry,
  candleIndexAt,
  chartBaseline,
  chartGeometry,
  describeChart,
  nearestPointIndex,
  ohlc,
  parseChartType,
  parsePeriod,
  percentChange,
  periodChange,
  resolvePeriod,
  scrubPoint,
  withLiveQuote,
} from '../src/chart';

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
      min: 0,
      max: 0,
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

describe('axisCandles', () => {
  it('picks five evenly spaced candles for the time axis', () => {
    const candles = Array.from({ length: 9 }, (_, i) => candle(i, 100 + i));

    expect(axisCandles(candles).map((c) => c?.t)).toEqual([0, 2, 4, 6, 8]);
  });

  it('returns empty slots when there are no candles', () => {
    expect(axisCandles([])).toEqual([undefined, undefined, undefined, undefined, undefined]);
  });
});

describe('resolvePeriod', () => {
  it('keeps the selected period while it is enabled', () => {
    expect(resolvePeriod(['1D', '1W'], '1W')).toBe('1W');
  });

  it('falls back to the first enabled period when the admin disables the selected one', () => {
    expect(resolvePeriod(['1M', '1Y'], '1D')).toBe('1M');
  });
});

describe('percentChange', () => {
  it('measures a move relative to where it started', () => {
    expect(percentChange(200, 210)).toBe(5);
  });
});

describe('describeChart', () => {
  it('summarises the move and the range instead of reading every point', () => {
    const candles = [candle(1, 100), candle(2, 104)];
    expect(describeChart('AAPL', '1D', candles, 100)).toBe(
      'AAPL up 4.00% today, low $99.00, high $105.00',
    );
    expect(describeChart('AAPL', '1M', candles, 104)).toBe(
      'AAPL flat over 1M, low $99.00, high $105.00',
    );
  });

  it('falls back to a plain label without data', () => {
    expect(describeChart('AAPL', '1W', [], null)).toBe('AAPL price chart, 1W');
  });
});

describe('candleGeometry', () => {
  const candles: Candle[] = [
    { t: 1, o: 10, h: 12, l: 9, c: 11, v: 100 },
    { t: 2, o: 11, h: 11.5, l: 8, c: 9, v: 50 },
  ];

  it('draws a body and wick per candle, coloured by direction', () => {
    const { shapes, min, max } = candleGeometry(candles, 100, 40, 0);

    expect([min, max]).toEqual([8, 12]);
    expect(shapes.map((s) => s.up)).toEqual([true, false]);
    expect(shapes[0]).toMatchObject({ x: 25, width: 30, wickTop: 0, closeY: 10, volume: 1 });
    expect(shapes[1]?.volume).toBe(0.5);
  });

  it('returns nothing for an empty series', () => {
    expect(candleGeometry([], 100, 40).shapes).toEqual([]);
  });
});

describe('axisTicks', () => {
  it('spreads labels evenly from the top of the chart to the bottom', () => {
    expect(axisTicks(100, 200)).toEqual([200, 150, 100]);
    expect(axisTicks(100, 200, 1)).toEqual([200]);
  });
});

describe('parseChartType and parsePeriod', () => {
  it('reads a URL or stored value and falls back to the defaults', () => {
    expect(parseChartType('candle')).toBe('candle');
    expect(parseChartType('bars')).toBe('area');
    expect(parsePeriod('1M')).toBe('1M');
    expect(parsePeriod(null)).toBe('1D');
  });
});

describe('candleIndexAt', () => {
  it('maps a position to its candle slot, clamped at the edges', () => {
    expect(candleIndexAt(4, 100, 0)).toBe(0);
    expect(candleIndexAt(4, 100, 30)).toBe(1);
    expect(candleIndexAt(4, 100, 250)).toBe(3);
    expect(candleIndexAt(4, 100, -10)).toBe(0);
  });

  it('returns -1 when there is nothing to select', () => {
    expect(candleIndexAt(0, 100, 10)).toBe(-1);
  });
});

describe('scrubPoint', () => {
  it('measures the scrubbed close against the baseline', () => {
    expect(scrubPoint(candle(1, 110), 100)).toEqual({ candle: candle(1, 110), changePct: 10 });
  });

  it('reads flat without a baseline', () => {
    expect(scrubPoint(candle(1, 110), null).changePct).toBe(0);
  });
});

describe('periodChange', () => {
  it('compares the last close with the baseline', () => {
    expect(periodChange([candle(1, 100), candle(2, 90)], 100)).toEqual({ value: -10, pct: -10 });
  });

  it('is null without candles or a baseline', () => {
    expect(periodChange([], 100)).toBeNull();
    expect(periodChange([candle(1, 100)], null)).toBeNull();
  });
});

describe('ohlc', () => {
  it('formats open, high, low and close', () => {
    expect(ohlc({ t: 1, o: 10, h: 12, l: 9, c: 11, v: 1 })).toEqual([
      { label: 'Open', value: '$10.00' },
      { label: 'High', value: '$12.00' },
      { label: 'Low', value: '$9.00' },
      { label: 'Close', value: '$11.00' },
    ]);
  });
});
