import * as Haptics from 'expo-haptics';
import { Pressable, View } from 'react-native';

import { type Period, PERIODS } from '@sarwa/contracts';

import { useCopy } from '../../lib/i18n';
import { cx } from '../../lib/theme';
import { Text } from '../ui/text';

export function PeriodTabs({
  value,
  onChange,
  enabled = PERIODS,
  size = 'lg',
}: {
  value: Period;
  onChange: (period: Period) => void;
  enabled?: readonly Period[];
  size?: 'md' | 'lg';
}) {
  const { t } = useCopy();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={t.chart.period}
      className="flex-row gap-0.5 rounded-seg bg-surface-3 p-seg-pad"
    >
      {PERIODS.map((period) => {
        const selected = period === value;
        const disabled = !enabled.includes(period);
        return (
          <Pressable
            key={period}
            accessibilityRole="tab"
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            // Tops up the segment to a 44 pt target inside the track's padding.
            hitSlop={{ top: size === 'lg' ? 3 : 6, bottom: size === 'lg' ? 3 : 6 }}
            onPress={() => {
              void Haptics.selectionAsync();
              onChange(period);
            }}
            className={cx(
              'flex-1 items-center justify-center rounded-control-sm',
              size === 'lg' ? 'h-seg-lg' : 'h-8',
              selected && 'bg-surface dark:bg-border-strong',
              disabled && 'opacity-40',
            )}
          >
            <Text variant="sm" weight={600} className={selected ? 'text-fg' : 'text-fg-2'}>
              {period}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
