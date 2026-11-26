import { type Direction, DIRECTION_ARROW, direction as toDirection } from '@sarwa/core';

import { cn } from '../lib/cn';

const PILL_SIZES = {
  sm: 'h-[22px] min-w-[68px] rounded-sm px-1.5 text-xs',
  md: 'h-[26px] min-w-[78px] rounded-[7px] px-2 text-[13px]',
  lg: 'h-8 rounded-[9px] px-2.5 text-[15px]',
} as const;

const DIRECTION_STYLES: Record<Direction, string> = {
  up: 'bg-pos-subtle text-pos',
  down: 'bg-neg-subtle text-neg',
  flat: 'bg-flat-subtle text-flat',
};

export function ChangePill({
  value,
  label,
  size = 'md',
  className,
}: {
  value: number;
  label: string;
  size?: keyof typeof PILL_SIZES;
  className?: string;
}) {
  const direction = toDirection(value);
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
