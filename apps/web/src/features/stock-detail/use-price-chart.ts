import { type KeyboardEvent, type PointerEvent, useState } from 'react';

import { type Period } from '@sarwa/contracts';
import {
  axisTicks,
  candleGeometry,
  chartGeometry,
  formatCandleDate,
  formatPrice,
  nearestPointIndex,
  percentChange,
  useChartSeries,
} from '@sarwa/core';

export type ChartType = 'area' | 'candle';

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
    const candle = series.candles[index];
    if (!shape || !candle) return undefined;
    return {
      x: shape.x,
      y: candle.c >= candle.o ? shape.bodyTop : shape.bodyTop + shape.bodyHeight,
    };
  };

  const indexAt = (event: PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH;
    if (type === 'area') return nearestPointIndex(area.points, x);
    return Math.min(count - 1, Math.max(0, Math.floor(x / (VIEW_WIDTH / count))));
  };

  const activeCandle = active === null ? undefined : series.candles[active];
  const activePoint = active === null ? undefined : pointAt(active);
  const last = series.candles.at(-1);

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
    periodChange:
      last && series.baseline !== null
        ? { value: last.c - series.baseline, pct: percentChange(series.baseline, last.c) }
        : null,
    crosshair:
      activeCandle && activePoint
        ? {
            candle: activeCandle,
            changePct: percentChange(series.baseline ?? activeCandle.c, activeCandle.c),
            xPct: (activePoint.x / VIEW_WIDTH) * 100,
            yPct: (activePoint.y / height) * 100,
          }
        : null,
    slider: {
      max: Math.max(0, count - 1),
      now: active ?? Math.max(0, count - 1),
      text: activeCandle
        ? `${formatCandleDate(activeCandle.t, period)}, ${formatPrice(activeCandle.c)}`
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
