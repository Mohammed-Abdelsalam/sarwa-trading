import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { type GestureResponderEvent, type ViewProps } from 'react-native';

import { type Candle, type Period } from '@sarwa/contracts';
import { chartGeometry, nearestPointIndex, useCandles } from '@sarwa/core';

const LONG_PRESS_MS = 150;
const PADDING = 12;
const AXIS_STOPS = [0, 0.25, 0.5, 0.75, 1];

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
  const [active, setActive] = useState<number | null>(null);
  const activeRef = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const data = candles.data ?? [];
  const { line, area, points } = chartGeometry(
    data.map((c) => c.c),
    width,
    height,
    PADDING,
  );

  const select = (index: number | null) => {
    if (index === activeRef.current) return;
    activeRef.current = index;
    setActive(index);
    onScrub(index === null ? null : (data[index] ?? null));
    if (index !== null) void Haptics.selectionAsync();
  };
  const indexAt = (event: GestureResponderEvent) =>
    nearestPointIndex(points, event.nativeEvent.locationX);
  const end = () => {
    clearTimeout(timer.current);
    select(null);
  };

  // Long-press to scrub, so a quick vertical swipe still scrolls the page.
  const scrubHandlers: ViewProps = {
    onStartShouldSetResponder: () => true,
    onResponderGrant: (event) => {
      const index = indexAt(event);
      timer.current = setTimeout(() => {
        select(index);
      }, LONG_PRESS_MS);
    },
    onResponderMove: (event) => {
      if (activeRef.current !== null) select(indexAt(event));
    },
    onResponderRelease: end,
    onResponderTerminate: end,
    onResponderTerminationRequest: () => activeRef.current === null,
  };

  return {
    state: candles.isPending ? 'loading' : candles.isError ? 'error' : 'ready',
    retry: () => void candles.refetch(),
    line,
    area,
    rising: (data.at(-1)?.c ?? 0) >= (data[0]?.c ?? 0),
    activePoint: active === null ? null : (points[active] ?? null),
    lastPoint: points.at(-1) ?? null,
    axisLabels: AXIS_STOPS.map((f) => data[Math.round(f * (data.length - 1))]),
    scrubHandlers,
  } as const;
}
