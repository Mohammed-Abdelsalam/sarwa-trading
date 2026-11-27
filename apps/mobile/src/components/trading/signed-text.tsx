import { type Direction, DIRECTION_ARROW } from '@sarwa/core';

import { cx } from '../../lib/theme';
import { Text, type TextVariant } from '../ui/text';

const COLOR: Record<Direction, string> = { up: 'text-pos', down: 'text-neg', flat: 'text-fg' };

// P&L colour always comes with an arrow, so the sign reads without colour too.
export function SignedText({
  value,
  variant = 'sm',
  arrow = true,
  className,
}: {
  value: { label: string; direction: Direction };
  variant?: TextVariant;
  arrow?: boolean;
  className?: string;
}) {
  const showArrow = arrow && value.direction !== 'flat';
  return (
    <Text
      variant={variant}
      weight={600}
      className={cx(COLOR[value.direction], className)}
      style={{ fontVariant: ['tabular-nums'] }}
    >
      {showArrow ? `${DIRECTION_ARROW[value.direction]} ${value.label}` : value.label}
    </Text>
  );
}
