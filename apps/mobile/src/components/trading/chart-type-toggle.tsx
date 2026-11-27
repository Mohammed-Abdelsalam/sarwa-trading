import * as Haptics from 'expo-haptics';
import { ChartArea, ChartCandlestick, type LucideIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { CHART_TYPES, type ChartType } from '@sarwa/core';

import { useCopy } from '../../lib/i18n';
import { cx, useColors } from '../../lib/theme';

const ICONS: Record<ChartType, LucideIcon> = { area: ChartArea, candle: ChartCandlestick };

// Same radiogroup semantics as the web SegmentedControl, so both apps announce it the same way.
export function ChartTypeToggle({
  value,
  onChange,
}: {
  value: ChartType;
  onChange: (type: ChartType) => void;
}) {
  const colors = useColors();
  const { t } = useCopy();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t.chart.type}
      className="flex-row gap-0.5 rounded-seg bg-surface-3 p-seg-pad"
    >
      {CHART_TYPES.map((type) => {
        const selected = type === value;
        const Icon = ICONS[type];
        return (
          <Pressable
            key={type}
            accessibilityRole="radio"
            accessibilityLabel={t.chart.types[type]}
            accessibilityState={{ checked: selected }}
            onPress={() => {
              void Haptics.selectionAsync();
              onChange(type);
            }}
            className={cx(
              'h-seg-lg w-11 items-center justify-center rounded-control-sm',
              selected && 'bg-surface dark:bg-border-strong',
            )}
          >
            <Icon size={18} color={selected ? colors.fg : colors['fg-2']} />
          </Pressable>
        );
      })}
    </View>
  );
}
