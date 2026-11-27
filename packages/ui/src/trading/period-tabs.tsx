import { type KeyboardEvent } from 'react';

import { type Period, PERIODS } from '@sarwa/contracts';

import { cn } from '../lib/cn';

export function PeriodTabs({
  value,
  onChange,
  enabled = PERIODS,
  size = 'md',
  label,
  className,
}: {
  value: Period;
  onChange: (period: Period) => void;
  enabled?: readonly Period[];
  size?: 'md' | 'lg';
  label: string;
  className?: string;
}) {
  const choices = PERIODS.filter((period) => enabled.includes(period));

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = choices.indexOf(value);
    const rtl = event.currentTarget.closest('[dir]')?.getAttribute('dir') === 'rtl';
    const after = choices[(index + 1) % choices.length];
    const before = choices[(index - 1 + choices.length) % choices.length];
    const next = {
      ArrowRight: rtl ? before : after,
      ArrowLeft: rtl ? after : before,
      Home: choices[0],
      End: choices.at(-1),
    }[event.key];
    if (!next) return;
    event.preventDefault();
    onChange(next);
    event.currentTarget.querySelector<HTMLButtonElement>(`[data-period="${next}"]`)?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        'bg-surface-3 rounded-seg p-seg-pad inline-flex gap-0.5',
        size === 'lg' && 'flex w-full',
        className,
      )}
    >
      {PERIODS.map((period) => {
        const selected = period === value;
        const disabled = !enabled.includes(period);
        return (
          <button
            key={period}
            type="button"
            role="tab"
            data-period={period}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            disabled={disabled}
            onClick={() => {
              onChange(period);
            }}
            className={cn(
              'text-fg-2 rounded-control-sm type-sm min-w-11 flex-1 cursor-pointer px-2.5 font-semibold tabular-nums transition-colors duration-200',
              size === 'lg' ? 'h-seg-lg' : 'h-8',
              'hover:text-fg disabled:cursor-not-allowed disabled:opacity-40',
              'focus-visible:outline-focus focus-visible:outline-2 focus-visible:outline-offset-2',
              selected && 'bg-surface text-fg shadow-e1 dark:bg-border-strong',
            )}
          >
            {period}
          </button>
        );
      })}
    </div>
  );
}
