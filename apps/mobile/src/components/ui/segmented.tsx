import * as Haptics from 'expo-haptics';
import { Pressable, View } from 'react-native';

import { cx } from '../../lib/theme';
import { Text } from './text';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  a11yLabel?: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = 'md',
  full = false,
}: {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  size?: 'sm' | 'md';
  full?: boolean;
}) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      className={cx(
        'flex-row gap-0.5 rounded-seg bg-surface-3 p-seg-pad',
        full ? 'w-full' : 'self-start',
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.a11yLabel ?? option.label}
            accessibilityState={{ checked: selected }}
            hitSlop={size === 'sm' ? 8 : 3}
            onPress={() => {
              if (selected) return;
              void Haptics.selectionAsync();
              onChange(option.value);
            }}
            className={cx(
              'items-center justify-center rounded-control-sm px-3',
              size === 'sm' ? 'min-h-7' : 'min-h-seg-lg',
              full && 'flex-1',
              selected && 'bg-surface dark:bg-border-strong',
            )}
          >
            <Text variant="sm" weight={600} className={selected ? 'text-fg' : 'text-fg-2'}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
