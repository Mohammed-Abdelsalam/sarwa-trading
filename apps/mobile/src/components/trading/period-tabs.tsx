import * as Haptics from 'expo-haptics';
import { Pressable, View } from 'react-native';

import { type Period, PERIODS } from '@sarwa/contracts';

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
  return (
    <View
      accessibilityRole="tablist"
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
