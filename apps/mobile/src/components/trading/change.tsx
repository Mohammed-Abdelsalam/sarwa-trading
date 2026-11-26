import { View } from 'react-native';

import { type Direction, DIRECTION_ARROW, direction as toDirection } from '@sarwa/core';

import { cx } from '../../lib/theme';
import { Text } from '../ui/text';

const PILL_TONE: Record<Direction, string> = {
  up: 'bg-pos-subtle',
  down: 'bg-neg-subtle',
  flat: 'bg-flat-subtle',
};
const TEXT_TONE: Record<Direction, string> = {
  up: 'text-pos',
  down: 'text-neg',
  flat: 'text-flat',
};

export function ChangePill({ value, label }: { value: number; label: string }) {
  const direction = toDirection(value);
  return (
    <View
      className={cx(
        'h-[22px] min-w-[68px] flex-row items-center justify-center gap-1 rounded-sm px-1.5',
        PILL_TONE[direction],
      )}
    >
      <Text variant="caption" className={TEXT_TONE[direction]} style={{ fontSize: 8 }}>
        {DIRECTION_ARROW[direction]}
      </Text>
      <Text
        variant="caption"
        className={TEXT_TONE[direction]}
        style={{ fontFamily: 'Inter_600SemiBold', fontVariant: ['tabular-nums'] }}
      >
        {label}
      </Text>
    </View>
  );
}

export function ChangeText({ value, label }: { value: number; label: string }) {
  const direction = toDirection(value);
  return (
    <Text variant="sm" className={TEXT_TONE[direction]} style={{ fontVariant: ['tabular-nums'] }}>
      {DIRECTION_ARROW[direction]} {label}
    </Text>
  );
}
