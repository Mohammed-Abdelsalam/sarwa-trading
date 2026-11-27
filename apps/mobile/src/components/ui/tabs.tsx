import * as Haptics from 'expo-haptics';
import { Pressable, View } from 'react-native';

import { cx } from '../../lib/theme';
import { Text } from './text';

export function Tabs<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View accessibilityRole="tablist" className="flex-row gap-5 border-b border-border px-4">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => {
              void Haptics.selectionAsync();
              onChange(option.value);
            }}
            className={cx(
              '-mb-px min-h-11 justify-center border-b-2',
              selected ? 'border-brand' : 'border-transparent',
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
