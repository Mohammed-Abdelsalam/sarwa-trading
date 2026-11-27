import * as Haptics from 'expo-haptics';
import { Pressable } from 'react-native';

import { cx } from '../../lib/theme';
import { Text } from './text';

export function Chip({
  label,
  selected,
  onPress,
  a11yLabel,
  compact = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  a11yLabel?: string;
  compact?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={a11yLabel ?? label}
      accessibilityState={{ checked: selected }}
      hitSlop={compact ? 7 : 5}
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      className={cx(
        'items-center justify-center rounded-full border px-3.5',
        compact ? 'min-h-[30px]' : 'min-h-[34px]',
        selected ? 'border-fg bg-fg' : 'border-border-strong',
      )}
    >
      <Text variant="sm" weight={600} className={selected ? 'text-bg' : 'text-fg-2'}>
        {label}
      </Text>
    </Pressable>
  );
}
