import { type Candle, type Period, PERIODS, type Quote } from '@sarwa/contracts';
import { absolute, percentToBps } from '@sarwa/domain';

import { direction, formatPrice, type Localized } from './format';
import { type KeyStat } from './markets';

export const CHART_TYPES = ['area', 'candle'] as const;
export type ChartType = (typeof CHART_TYPES)[number];

export function parseChartType(value: string | null): ChartType {
  return value === 'candle' ? 'candle' : 'area';
}

export function parsePeriod(value: string | null): Period {
  return PERIODS.find((p) => p === value) ?? '1D';
}

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

export interface ChartFrame {
  width: number;
  height: number;
  padding?: number;
}

// Every point but the last, laid out for `count` points; reused for as long as the history holds.
export interface ChartHead {
  points: ChartPoint[];
  line: string;
  min: number;
  max: number;
  count: number;
}

export function chartHead(
  values: readonly number[],
  { width, height, padding = 2 }: ChartFrame,
  reference?: number,
): ChartHead | null {
  if (values.length < 2) return null;
  const head = values.slice(0, -1);
  const domain = reference === undefined ? head : [...head, reference];
  const min = Math.min(...domain);
  const max = Math.max(...domain);
  const range = max - min || 1;
  const points = head.map((value, i) => ({
    x: (i / (values.length - 1)) * width,
    y: padding + (1 - (value - min) / range) * (height - padding * 2),
    value,
  }));
  const line = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join('');
  return { points, line, min, max, count: values.length };
}

// A live tick only places the last point. Once it leaves the head's range the scale changes, so
// everything is laid out again; either way the result equals chartGeometry over all the values.
export function withLastPoint(
  head: ChartHead | null,
  values: readonly number[],
  frame: ChartFrame,
  reference?: number,
): ChartGeometry {
  const last = values.at(-1);
  const { width, height, padding = 2 } = frame;
  if (
    !head ||
    last === undefined ||
    head.count !== values.length ||
    last < head.min ||
    last > head.max
  ) {
    return chartGeometry(values, width, height, padding, reference);
  }
  const range = head.max - head.min || 1;
  const toY = (value: number) =>
    padding + (1 - (value - head.min) / range) * (height - padding * 2);
  const point = { x: width, y: toY(last), value: last };
  const line = `${head.line}L${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
  return {
    line,
    area: `${line}L${width} ${height}L0 ${height}Z`,
    points: [...head.points, point],
    referenceY: reference === undefined ? null : toY(reference),
    min: head.min,
    max: head.max,
  };
}

// The directive lets the mobile chart call this on the UI thread; it's a no-op string elsewhere.
export function nearestPointIndex(points: readonly Pick<ChartPoint, 'x'>[], x: number): number {
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

// The text alternative for a chart: overall move plus the range, read once instead of every tick.
export function describeChart(
  { t, f }: Localized,
  symbol: string,
  period: Period,
  candles: readonly Candle[],
  baseline: number | null,
): string {
  const last = candles.at(-1);
  if (!last || baseline === null) return t.chart.empty({ symbol, period });
  const pct = percentChange(baseline, last.c);
  return t.chart.summary[direction(pct)]({
    symbol,
    pct: f.percent(absolute(percentToBps(pct))),
    when: period === '1D' ? t.chart.today : t.chart.over({ period }),
    low: formatPrice(f, Math.min(...candles.map((c) => c.l))),
    high: formatPrice(f, Math.max(...candles.map((c) => c.h))),
  });
}

export interface CandleShape {
  x: number;
  width: number;
  bodyTop: number;
  bodyHeight: number;
  wickTop: number;
  wickBottom: number;
  up: boolean;
  closeY: number;
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
      closeY: toY(c.c),
      volume: c.v / maxVolume,
    };
  });
  return { shapes, min, max };
}

export function axisTicks(min: number, max: number, count = 3): number[] {
  if (count < 2) return [max];
  return Array.from({ length: count }, (_, i) => max - ((max - min) * i) / (count - 1));
}

// Like nearestPointIndex, but candles split the width into equal slots.
export function candleIndexAt(count: number, width: number, x: number): number {
  'worklet';
  if (count === 0 || width <= 0) return -1;
  return Math.min(count - 1, Math.max(0, Math.floor((x / width) * count)));
}

export interface ScrubPoint {
  candle: Candle;
  changePct: number;
}

export function scrubPoint(candle: Candle, baseline: number | null): ScrubPoint {
  return { candle, changePct: percentChange(baseline ?? candle.c, candle.c) };
}

export function periodChange(
  candles: readonly Candle[],
  baseline: number | null,
): { value: number; pct: number } | null {
  const last = candles.at(-1);
  if (!last || baseline === null) return null;
  return { value: last.c - baseline, pct: percentChange(baseline, last.c) };
}

export function ohlc({ t, f }: Localized, candle: Candle): KeyStat[] {
  return [
    { label: t.chart.ohlc.open, value: formatPrice(f, candle.o) },
    { label: t.chart.ohlc.high, value: formatPrice(f, candle.h) },
    { label: t.chart.ohlc.low, value: formatPrice(f, candle.l) },
    { label: t.chart.ohlc.close, value: formatPrice(f, candle.c) },
  ];
}
