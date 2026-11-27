import { type ComponentProps, type KeyboardEvent, type ReactNode } from 'react';

import { cn } from '../lib/cn';

const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

export interface ChipProps extends ComponentProps<'button'> {
  active?: boolean;
}

export function Chip({ active = false, className, ...props }: ChipProps) {
  return (
    <button
      type="button"
      className={cn(
        'type-sm duration-120 inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 font-semibold transition-colors',
        active
          ? 'border-fg bg-fg text-bg'
          : 'border-border-strong text-fg-2 hover:bg-surface-3 hover:text-fg bg-transparent',
        focusRing,
        className,
      )}
      {...props}
    />
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const index = options.findIndex((o) => o.value === value);
    const next = options[(index + step + options.length) % options.length];
    if (!next) return;
    onChange(next.value);
    event.currentTarget.querySelector<HTMLButtonElement>(`[data-value="${next.value}"]`)?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn('bg-surface-3 rounded-seg p-seg-pad inline-flex gap-0.5', className)}
    >
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            data-value={option.value}
            aria-checked={checked}
            aria-label={option.icon ? option.label : undefined}
            tabIndex={checked ? 0 : -1}
            onClick={() => {
              onChange(option.value);
            }}
            className={cn(
              'text-fg-2 type-sm rounded-control-sm hover:text-fg inline-flex h-8 min-w-11 cursor-pointer items-center justify-center gap-1.5 px-2.5 font-semibold transition-colors duration-200 [&>svg]:size-4',
              checked && 'bg-surface text-fg shadow-e1 dark:bg-border-strong',
              focusRing,
            )}
          >
            {option.icon ?? option.label}
          </button>
        );
      })}
    </div>
  );
}
