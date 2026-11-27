import { type Direction, DIRECTION_ARROW, direction as toDirection } from '@sarwa/core';
import { type ChangePillSize } from '@sarwa/tokens';

import { cn } from '../lib/cn';

const PILL_SIZES: Record<ChangePillSize, string> = {
  sm: 'h-pill-sm min-w-pill-sm-min rounded-sm px-1.5 text-xs',
  md: 'h-pill-md min-w-pill-md-min rounded-pill type-sm px-2',
  lg: 'rounded-pill-lg type-body h-8 px-2.5',
};

const DIRECTION_STYLES: Record<Direction, string> = {
  up: 'bg-pos-subtle text-pos',
  down: 'bg-neg-subtle text-neg',
  flat: 'bg-flat-subtle text-flat',
};

const INLINE_STYLES: Record<Direction, string> = {
  up: 'text-pos',
  down: 'text-neg',
  flat: 'text-flat',
};

export function ChangePill({
  value,
  label,
  size = 'md',
  variant = 'pill',
  className,
}: {
  value: number;
  label: string;
  size?: ChangePillSize;
  variant?: 'pill' | 'inline';
  className?: string;
}) {
  const direction = toDirection(value);
  if (variant === 'inline') {
    return (
      <span
        className={cn('type-sm font-semibold tabular-nums', INLINE_STYLES[direction], className)}
      >
        {DIRECTION_ARROW[direction]} {label}
      </span>
    );
  }
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center gap-1 whitespace-nowrap font-semibold tabular-nums leading-none',
        PILL_SIZES[size],
        DIRECTION_STYLES[direction],
        className,
      )}
    >
      <span aria-hidden className="text-[0.62em]">
        {DIRECTION_ARROW[direction]}
      </span>
      {label}
    </span>
  );
}
