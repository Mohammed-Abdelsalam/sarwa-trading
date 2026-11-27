import { type KeyboardEvent, type PointerEvent, useState } from 'react';

import { type Period } from '@sarwa/contracts';
import {
  axisTicks,
  candleGeometry,
  candleIndexAt,
  chartGeometry,
  type ChartType,
  formatPrice,
  nearestPointIndex,
  scrubPoint,
  useChartSeries,
  useI18n,
} from '@sarwa/core';

// The SVG draws in a fixed 800-wide viewBox and stretches; positions are reported as percentages.
const VIEW_WIDTH = 800;
const PADDING = 12;

export function usePriceChart({
  symbol,
  period,
  type,
  height,
}: {
  symbol: string;
  period: Period;
  type: ChartType;
  height: number;
}) {
  const { f } = useI18n();
  const series = useChartSeries(symbol, period);
  const [active, setActive] = useState<number | null>(null);
  const count = series.candles.length;

  const area = chartGeometry(
    series.candles.map((c) => c.c),
    VIEW_WIDTH,
    height,
    PADDING,
    series.showBaseline ? (series.baseline ?? undefined) : undefined,
  );
  const candles = candleGeometry(series.candles, VIEW_WIDTH, height, PADDING);
  const [min, max] = type === 'candle' ? [candles.min, candles.max] : [area.min, area.max];

  const pointAt = (index: number) => {
    if (type === 'area') return area.points[index];
    const shape = candles.shapes[index];
    return shape ? { x: shape.x, y: shape.closeY } : undefined;
  };

  const indexAt = (event: PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH;
    return type === 'area'
      ? nearestPointIndex(area.points, x)
      : candleIndexAt(count, VIEW_WIDTH, x);
  };

  const activeCandle = active === null ? undefined : series.candles[active];
  const activePoint = active === null ? undefined : pointAt(active);

  return {
    state: series.state,
    retry: series.retry,
    summary: series.summary,
    rising: series.rising,
    viewBox: `0 0 ${String(VIEW_WIDTH)} ${String(height)}`,
    area,
    candles: candles.shapes,
    baselineY: area.referenceY,
    ticks: axisTicks(min, max, 3),
    axisCandles: series.axisCandles,
    periodChange: series.periodChange,
    crosshair:
      activeCandle && activePoint
        ? {
            ...scrubPoint(activeCandle, series.baseline),
            xPct: (activePoint.x / VIEW_WIDTH) * 100,
            yPct: (activePoint.y / height) * 100,
          }
        : null,
    slider: {
      max: Math.max(0, count - 1),
      now: active ?? Math.max(0, count - 1),
      text: activeCandle
        ? `${f.chartDate(activeCandle.t, period)}, ${formatPrice(f, activeCandle.c)}`
        : series.summary,
    },
    // Hover on web; ← → step through points and Esc leaves, as the canvas specifies (Dev-Notes 04).
    handlers: {
      onPointerMove: (event: PointerEvent<HTMLElement>) => {
        if (count > 0) setActive(indexAt(event));
      },
      onPointerLeave: () => {
        setActive(null);
      },
      onBlur: () => {
        setActive(null);
      },
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
        if (event.key === 'Escape') {
          setActive(null);
          return;
        }
        const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
        if (!step || count === 0) return;
        event.preventDefault();
        setActive((current) => Math.min(count - 1, Math.max(0, (current ?? count - 1) + step)));
      },
    },
  };
}
