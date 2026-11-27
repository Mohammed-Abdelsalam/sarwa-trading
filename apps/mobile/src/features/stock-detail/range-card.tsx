import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { formatPrice } from '@sarwa/core';

import { Text } from '../../components/ui/text';
import { useColors } from '../../lib/theme';

export function RangeCard({
  low,
  high,
  position,
}: {
  low: number;
  high: number;
  position: number;
}) {
  const colors = useColors();
  const percent = Math.round(position * 100);
  return (
    <View className="mx-5 mt-4 gap-2.5 rounded-lg border border-border bg-surface px-4 py-4">
      <Text variant="overline" className="text-fg-3">
        52-week range
      </Text>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="Price within the 52-week range"
        accessibilityValue={{
          min: 0,
          max: 100,
          now: percent,
          text: `${String(percent)}% of the way from ${formatPrice(low)} to ${formatPrice(high)}`,
        }}
        className="h-1.5 justify-center rounded-full bg-surface-3"
      >
        <Svg width={`${String(percent)}%`} height="100%">
          <Defs>
            <LinearGradient id="range" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={colors.neg} />
              <Stop offset="0.5" stopColor={colors.warn} />
              <Stop offset="1" stopColor={colors.pos} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" rx={3} fill="url(#range)" />
        </Svg>
        <View
          className="absolute -ml-0.5 h-4 w-1 rounded-xs bg-fg"
          style={{ left: `${String(percent)}%` }}
        />
      </View>
      <View className="flex-row justify-between">
        <Text variant="num-sm" className="text-fg-2">
          {formatPrice(low)}
        </Text>
        <Text variant="num-sm" className="text-fg-2">
          {formatPrice(high)}
        </Text>
      </View>
    </View>
  );
}
