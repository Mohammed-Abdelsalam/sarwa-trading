import { type Candle, type Period, type Quote } from '@sarwa/contracts';

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
}

// `reference` (e.g. the previous close) is kept inside the vertical range so its line stays visible.
export function chartGeometry(
  values: readonly number[],
  width: number,
  height: number,
  padding = 2,
  reference?: number,
): ChartGeometry {
  if (values.length < 2) return { line: '', area: '', points: [], referenceY: null };
  const domain = reference === undefined ? values : [...values, reference];
  const min = Math.min(...domain);
  const range = Math.max(...domain) - min || 1;
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
