import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { formatPrice, percentToBps } from '@sarwa/core';

import { Text } from '../../components/ui/text';
import { useCopy } from '../../lib/i18n';
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
  const { t, f } = useCopy();
  const weeks = f.count(52);
  return (
    <View className="mx-5 mt-4 gap-2.5 rounded-lg border border-border bg-surface px-4 py-4">
      <Text variant="overline" className="text-fg-3">
        {t.stock.range(weeks)}
      </Text>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={t.stock.rangeLabel(weeks)}
        accessibilityValue={{
          min: 0,
          max: 100,
          now: percent,
          text: t.stock.rangeValue({
            pct: f.percent(percentToBps(percent)),
            low: formatPrice(f, low),
            high: formatPrice(f, high),
          }),
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
          className="absolute -ms-0.5 h-4 w-1 rounded-xs bg-fg"
          style={{ start: `${String(percent)}%` }}
        />
      </View>
      <View className="flex-row justify-between">
        <Text variant="num-sm" className="text-fg-2">
          {formatPrice(f, low)}
        </Text>
        <Text variant="num-sm" className="text-fg-2">
          {formatPrice(f, high)}
        </Text>
      </View>
    </View>
  );
}
