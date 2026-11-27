import * as Haptics from 'expo-haptics';
import { usePanGesture } from 'react-native-gesture-handler';
import { useAnimatedProps, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { type Period } from '@sarwa/contracts';
import {
  candleGeometry,
  candleIndexAt,
  type ChartType,
  nearestPointIndex,
  type ScrubPoint,
  scrubPoint,
  useChartSeries,
} from '@sarwa/core';

const LONG_PRESS_MS = 150;
const PADDING = 12;
const NONE = -1;

export function usePriceChart({
  symbol,
  period,
  type,
  width,
  height,
  onScrub,
}: {
  symbol: string;
  period: Period;
  type: ChartType;
  width: number;
  height: number;
  onScrub: (point: ScrubPoint | null) => void;
}) {
  const series = useChartSeries(symbol, period, { width, height, padding: PADDING });
  const activeIndex = useSharedValue(NONE);
  const count = series.candles.length;

  const { area } = series;
  const candles = candleGeometry(series.candles, width, height, PADDING);
  // The crosshair rides the line in area mode and each candle's close in candle mode.
  const points =
    type === 'area'
      ? area.points
      : candles.shapes.map((shape) => ({ x: shape.x, y: shape.closeY }));

  const select = (index: number) => {
    const candle = index === NONE ? undefined : series.candles[index];
    onScrub(candle ? scrubPoint(candle, series.baseline) : null);
    if (candle) void Haptics.selectionAsync();
  };

  // Runs on the UI thread; React only hears about it when the selected candle changes.
  const track = (x: number) => {
    'worklet';
    const index = type === 'candle' ? candleIndexAt(count, width, x) : nearestPointIndex(points, x);
    if (index === NONE || index === activeIndex.get()) return;
    activeIndex.set(index);
    scheduleOnRN(select, index);
  };

  // Long-press to scrub; moving before it fires fails the pan, so a quick swipe still scrolls the page.
  const scrubGesture = usePanGesture({
    activateAfterLongPress: LONG_PRESS_MS,
    onActivate: (event) => {
      track(event.x);
    },
    onUpdate: (event) => {
      track(event.x);
    },
    onFinalize: () => {
      if (activeIndex.get() === NONE) return;
      activeIndex.set(NONE);
      scheduleOnRN(select, NONE);
    },
  });

  const crosshairProps = useAnimatedProps(() => {
    const x = points[activeIndex.get()]?.x ?? 0;
    return { x1: x, x2: x, opacity: activeIndex.get() === NONE ? 0 : 1 };
  });
  const dotProps = useAnimatedProps(() => {
    const point = points[activeIndex.get()];
    return { cx: point?.x ?? 0, cy: point?.y ?? 0, opacity: point ? 1 : 0 };
  });
  const haloProps = useAnimatedProps(() => {
    const point = points[activeIndex.get()];
    return { cx: point?.x ?? 0, cy: point?.y ?? 0, opacity: point ? 0.2 : 0 };
  });

  return {
    state: series.state,
    retry: series.retry,
    summary: series.summary,
    periodChange: series.periodChange,
    line: area.line,
    area: area.area,
    candles: candles.shapes,
    rising: series.rising,
    baselineY: type === 'area' ? area.referenceY : null,
    lastPoint: type === 'area' ? (area.points.at(-1) ?? null) : null,
    axisLabels: series.axisCandles,
    scrubGesture,
    crosshairProps,
    dotProps,
    haloProps,
  } as const;
}
