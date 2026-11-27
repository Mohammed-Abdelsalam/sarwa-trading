import { View } from 'react-native';

import { type Direction, DIRECTION_ARROW, direction as toDirection } from '@sarwa/core';
import { type ChangePillSize, typography } from '@sarwa/tokens';

import { cx } from '../../lib/theme';
import { Text } from '../ui/text';

const SIZE: Record<ChangePillSize, [container: string, text: 'caption' | 'sm' | 'body']> = {
  sm: ['h-pill-sm min-w-pill-sm-min rounded-sm px-1.5', 'caption'],
  md: ['h-pill-md min-w-pill-md-min rounded-pill px-2', 'sm'],
  lg: ['h-8 rounded-pill-lg px-2.5', 'body'],
};

const BACKGROUND: Record<Direction, string> = {
  up: 'bg-pos-subtle',
  down: 'bg-neg-subtle',
  flat: 'bg-flat-subtle',
};

const COLOR: Record<Direction, string> = { up: 'text-pos', down: 'text-neg', flat: 'text-flat' };

// The canvas draws the arrow at 0.62em of the label.
const ARROW_SCALE = 0.62;

export function ChangePill({
  value,
  label,
  size = 'sm',
  variant = 'pill',
}: {
  value: number;
  label: string;
  size?: ChangePillSize;
  variant?: 'pill' | 'inline';
}) {
  const direction = toDirection(value);
  if (variant === 'inline') {
    return (
      <Text variant="sm" weight={600} className={COLOR[direction]}>
        {DIRECTION_ARROW[direction]} {label}
      </Text>
    );
  }
  const [container, text] = SIZE[size];
  return (
    <View
      className={cx('flex-row items-center justify-center gap-1', container, BACKGROUND[direction])}
    >
      <Text
        variant={text}
        className={COLOR[direction]}
        style={{ fontSize: Math.round(typography[text].size * ARROW_SCALE) }}
      >
        {DIRECTION_ARROW[direction]}
      </Text>
      <Text variant={text} weight={600} className={COLOR[direction]}>
        {label}
      </Text>
    </View>
  );
}
