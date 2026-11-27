import { type Candle, type Period, type Quote } from '@sarwa/contracts';

import { direction, formatPrice } from './format';

export interface ChartPoint {
  x: number;
  y: number;
  value: number;
}

export interface ChartGeometry {
  line: string;
  area: string;
  points: ChartPoint[];
  referenceY: number | null;
  min: number;
  max: number;
}

// `reference` (e.g. the previous close) is kept inside the vertical range so its line stays visible.
export function chartGeometry(
  values: readonly number[],
  width: number,
  height: number,
  padding = 2,
  reference?: number,
): ChartGeometry {
  if (values.length < 2)
    return { line: '', area: '', points: [], referenceY: null, min: 0, max: 0 };
  const domain = reference === undefined ? values : [...values, reference];
  const min = Math.min(...domain);
  const max = Math.max(...domain);
  const range = max - min || 1;
  const toY = (value: number) => padding + (1 - (value - min) / range) * (height - padding * 2);
  const points = values.map((value, i) => ({
    x: (i / (values.length - 1)) * width,
    y: toY(value),
    value,
  }));
  const line = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join('');
  return {
    line,
    area: `${line}L${width} ${height}L0 ${height}Z`,
    points,
    referenceY: reference === undefined ? null : toY(reference),
    min,
    max,
  };
}

// The directive lets the mobile chart call this on the UI thread; it's a no-op string elsewhere.
export function nearestPointIndex(points: readonly ChartPoint[], x: number): number {
  'worklet';
  if (points.length === 0) return -1;
  const last = points[points.length - 1]?.x ?? 0;
  const ratio = Math.min(Math.max(x / (last || 1), 0), 1);
  return Math.round(ratio * (points.length - 1));
}

export function withLiveQuote(
  candles: readonly Candle[],
  quote: Pick<Quote, 'price'> | undefined,
): readonly Candle[] {
  const last = candles.at(-1);
  if (!last || !quote) return candles;
  return [
    ...candles.slice(0, -1),
    { ...last, c: quote.price, h: Math.max(last.h, quote.price), l: Math.min(last.l, quote.price) },
  ];
}

// 1D is measured against yesterday's close so the chart colour matches the header's day change.
export function chartBaseline(
  period: Period,
  candles: readonly Candle[],
  quote: Pick<Quote, 'prevClose'> | undefined,
): number | null {
  if (period === '1D' && quote) return quote.prevClose;
  return candles[0]?.c ?? null;
}

const AXIS_STOPS = [0, 0.25, 0.5, 0.75, 1];

export function axisCandles(candles: readonly Candle[]): (Candle | undefined)[] {
  return AXIS_STOPS.map((f) => candles[Math.round(f * (candles.length - 1))]);
}

// The admin can disable the selected period while a chart is open; fall back to the first one left.
export function resolvePeriod(enabled: readonly Period[], selected: Period): Period {
  return enabled.includes(selected) ? selected : (enabled[0] ?? '1D');
}

export function percentChange(from: number, to: number): number {
  return ((to - from) / from) * 100;
}

const DIRECTION_WORD = { up: 'up', down: 'down', flat: 'flat' } as const;

// The text alternative for a chart: overall move plus the range, read once instead of every tick.
export function describeChart(
  symbol: string,
  period: Period,
  candles: readonly Candle[],
  baseline: number | null,
): string {
  const last = candles.at(-1);
  if (!last || baseline === null) return `${symbol} price chart, ${period}`;
  const pct = percentChange(baseline, last.c);
  const dir = direction(pct);
  const move = dir === 'flat' ? 'flat' : `${DIRECTION_WORD[dir]} ${Math.abs(pct).toFixed(2)}%`;
  const when = period === '1D' ? 'today' : `over ${period}`;
  const low = Math.min(...candles.map((c) => c.l));
  const high = Math.max(...candles.map((c) => c.h));
  return `${symbol} ${move} ${when}, low ${formatPrice(low)}, high ${formatPrice(high)}`;
}

export interface CandleShape {
  x: number;
  width: number;
  bodyTop: number;
  bodyHeight: number;
  wickTop: number;
  wickBottom: number;
  up: boolean;
  // Volume relative to the busiest candle, 0–1, for the volume bars under the chart.
  volume: number;
}

export function candleGeometry(
  candles: readonly Candle[],
  width: number,
  height: number,
  padding = 2,
): { shapes: CandleShape[]; min: number; max: number } {
  if (candles.length === 0) return { shapes: [], min: 0, max: 0 };
  const min = Math.min(...candles.map((c) => c.l));
  const max = Math.max(...candles.map((c) => c.h));
  const range = max - min || 1;
  const toY = (value: number) => padding + (1 - (value - min) / range) * (height - padding * 2);
  const slot = width / candles.length;
  const maxVolume = Math.max(...candles.map((c) => c.v)) || 1;
  const shapes = candles.map((c, i) => {
    const top = toY(Math.max(c.o, c.c));
    return {
      x: slot * i + slot / 2,
      width: Math.max(1, slot * 0.6),
      bodyTop: top,
      bodyHeight: Math.max(1, toY(Math.min(c.o, c.c)) - top),
      wickTop: toY(c.h),
      wickBottom: toY(c.l),
      up: c.c >= c.o,
      volume: c.v / maxVolume,
    };
  });
  return { shapes, min, max };
}

export function axisTicks(min: number, max: number, count = 3): number[] {
  if (count < 2) return [max];
  return Array.from({ length: count }, (_, i) => max - ((max - min) * i) / (count - 1));
}
