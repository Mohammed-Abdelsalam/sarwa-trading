import * as Haptics from 'expo-haptics';
import { usePanGesture } from 'react-native-gesture-handler';
import { useAnimatedProps, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { type Candle, type Period } from '@sarwa/contracts';
import {
  chartBaseline,
  chartGeometry,
  nearestPointIndex,
  useCandles,
  useQuote,
  withLiveQuote,
} from '@sarwa/core';

const LONG_PRESS_MS = 150;
const PADDING = 12;
const AXIS_STOPS = [0, 0.25, 0.5, 0.75, 1];
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
  const candles = useCandles(symbol, period);
  const quote = useQuote(symbol);
  const activeIndex = useSharedValue(NONE);

  const data = withLiveQuote(candles.data ?? [], quote);
  const baseline = chartBaseline(period, data, quote);
  const showBaseline = period === '1D' && baseline !== null;
  const { line, area, points, referenceY } = chartGeometry(
    data.map((c) => c.c),
    width,
    height,
    PADDING,
    showBaseline ? baseline : undefined,
  );
  const select = (index: number) => {
    onScrub(index === NONE ? null : (data[index] ?? null));
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
    state: candles.isPending ? 'loading' : candles.isError ? 'error' : 'ready',
    retry: () => void candles.refetch(),
    line,
    area,
    rising: (data.at(-1)?.c ?? 0) >= (baseline ?? 0),
    baselineY: referenceY,
    lastPoint: points.at(-1) ?? null,
    axisLabels: AXIS_STOPS.map((f) => data[Math.round(f * (data.length - 1))]),
    scrubGesture,
    crosshairProps,
    dotProps,
    haloProps,
  } as const;
}
