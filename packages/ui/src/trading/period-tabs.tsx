import { type KeyboardEvent } from 'react';

import { type Period, PERIODS } from '@sarwa/contracts';

import { cn } from '../lib/cn';

export function PeriodTabs({
  value,
  onChange,
  enabled = PERIODS,
  className,
}: {
  value: Period;
  onChange: (period: Period) => void;
  enabled?: readonly Period[];
  className?: string;
}) {
  const choices = PERIODS.filter((period) => enabled.includes(period));

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = choices.indexOf(value);
    const next = {
      ArrowRight: choices[(index + 1) % choices.length],
      ArrowLeft: choices[(index - 1 + choices.length) % choices.length],
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
      aria-label="Chart period"
      onKeyDown={onKeyDown}
      className={cn('bg-surface-3 inline-flex gap-0.5 rounded-[11px] p-[3px]', className)}
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
              'text-fg-2 h-8 min-w-11 flex-1 cursor-pointer rounded-[8px] px-2.5 text-[13px] font-semibold tabular-nums transition-colors duration-200',
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
