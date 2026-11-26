import * as Haptics from 'expo-haptics';
import { Pressable, View } from 'react-native';

import { type Period, PERIODS } from '@sarwa/contracts';

import { cx } from '../../lib/theme';
import { Text } from '../ui/text';

export function PeriodTabs({
  value,
  onChange,
  enabled,
}: {
  value: Period;
  onChange: (period: Period) => void;
  enabled: readonly Period[];
}) {
  return (
    <View
      accessibilityRole="tablist"
      className="flex-row gap-0.5 rounded-[11px] bg-surface-3 p-[3px]"
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
              'h-[38px] flex-1 items-center justify-center rounded-[8px]',
              selected && 'bg-surface dark:bg-border-strong',
              disabled && 'opacity-40',
            )}
          >
            <Text
              variant="sm"
              className={selected ? 'text-fg' : 'text-fg-2'}
              style={{ fontFamily: 'Inter_600SemiBold' }}
            >
              {period}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
