import * as Haptics from 'expo-haptics';
import { usePanGesture } from 'react-native-gesture-handler';
import { useAnimatedProps, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { type Candle, type Period } from '@sarwa/contracts';
import { chartGeometry, nearestPointIndex, useChartSeries } from '@sarwa/core';

const LONG_PRESS_MS = 150;
const PADDING = 12;
const NONE = -1;

export function usePriceChart({
  symbol,
  period,
  width,
  height,
  onScrub,
}: {
  symbol: string;
  period: Period;
  width: number;
  height: number;
  onScrub: (candle: Candle | null) => void;
}) {
  const series = useChartSeries(symbol, period);
  const activeIndex = useSharedValue(NONE);

  const { line, area, points, referenceY } = chartGeometry(
    series.candles.map((c) => c.c),
    width,
    height,
    PADDING,
    series.showBaseline ? (series.baseline ?? undefined) : undefined,
  );
  const select = (index: number) => {
    onScrub(index === NONE ? null : (series.candles[index] ?? null));
    if (index !== NONE) void Haptics.selectionAsync();
  };

  // Runs on the UI thread; React only hears about it when the selected candle changes.
  const track = (x: number) => {
    'worklet';
    const index = nearestPointIndex(points, x);
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
    line,
    area,
    rising: series.rising,
    baselineY: referenceY,
    lastPoint: points.at(-1) ?? null,
    axisLabels: series.axisCandles,
    scrubGesture,
    crosshairProps,
    dotProps,
    haloProps,
  } as const;
}
