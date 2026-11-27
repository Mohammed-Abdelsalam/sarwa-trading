import { Check, Clock } from 'lucide-react';
import { type ReactNode } from 'react';

import { cn } from '../lib/cn';

export interface EstimateRow {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}

export function EstimateRows({
  rows,
  total,
  dense = false,
  className,
}: {
  rows: readonly EstimateRow[];
  total?: EstimateRow;
  dense?: boolean;
  className?: string;
}) {
  const line = (row: EstimateRow, isTotal: boolean) => (
    <div
      key={row.label}
      className={cn(
        'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3',
        isTotal ? 'border-border mt-1 border-t pt-3 text-[0.9375rem]' : !dense && 'py-1.75',
      )}
    >
      <dt className={isTotal ? 'text-fg font-semibold' : 'text-fg-2'}>{row.label}</dt>
      <dd className="text-fg text-end font-semibold tabular-nums">{row.value}</dd>
      {row.hint ? <dd className="text-fg-3 col-span-2 mt-0.5 text-xs">{row.hint}</dd> : null}
    </div>
  );
  return (
    <dl className={cn('text-sm', dense && 'flex flex-col gap-1.5', className)}>
      {rows.map((row) => line(row, false))}
      {total ? line(total, true) : null}
    </dl>
  );
}

export type TimelineState = 'done' | 'now' | 'todo';

export interface TimelineStep {
  id?: string;
  title: string;
  meta?: ReactNode;
  state: TimelineState;
}

const DOT: Record<TimelineState, string> = {
  done: 'bg-pos-subtle text-pos',
  now: 'bg-warn-subtle text-warn',
  todo: 'bg-surface-3 text-fg-3',
};

export function Timeline({
  steps,
  stateLabels,
  className,
}: {
  steps: readonly TimelineStep[];
  stateLabels?: Record<TimelineState, string>;
  className?: string;
}) {
  return (
    <ol className={cn('flex flex-col', className)}>
      {steps.map((step) => (
        <li
          key={step.id ?? step.title}
          aria-current={step.state === 'now' ? 'step' : undefined}
          className={cn(
            'relative grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-3 pb-4.5',
            'before:bg-border before:absolute before:start-2.75 before:top-5.5 before:bottom-0 before:w-0.5 last:before:hidden',
          )}
        >
          <span
            aria-hidden
            className={cn('grid size-6 place-items-center rounded-full', DOT[step.state])}
          >
            {step.state === 'done' ? <Check className="size-3.5" /> : null}
            {step.state === 'now' ? <Clock className="size-3.5" /> : null}
            {step.state === 'todo' ? <span className="size-1.5 rounded-full bg-current" /> : null}
          </span>
          <div className="min-w-0">
            <p className="type-sm text-fg font-semibold">
              {step.title}
              {stateLabels ? <span className="sr-only">, {stateLabels[step.state]}</span> : null}
            </p>
            {step.meta ? <div className="type-caption text-fg-3">{step.meta}</div> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

export type DeltaTone = 'pos' | 'neg' | 'flat';

const DELTA: Record<DeltaTone, string> = { pos: 'text-pos', neg: 'text-neg', flat: 'text-fg-2' };

export function StatTile({
  label,
  value,
  delta,
  deltaTone = 'flat',
  caption,
  plain = false,
  className,
}: {
  label: string;
  value: ReactNode;
  delta?: ReactNode;
  deltaTone?: DeltaTone;
  caption?: ReactNode;
  plain?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-1',
        !plain &&
          'border-border bg-surface shadow-e1 rounded-lg border px-4 py-3.5 dark:shadow-none',
        className,
      )}
    >
      <span className="type-caption text-fg-2 font-semibold">{label}</span>
      <span className="text-fg text-2xl leading-7.5 font-bold tabular-nums">{value}</span>
      {delta !== undefined || caption !== undefined ? (
        <span className="type-caption">
          {delta !== undefined ? (
            <span className={cn('font-semibold', DELTA[deltaTone])}>{delta}</span>
          ) : null}{' '}
          {caption !== undefined ? <span className="text-fg-3">{caption}</span> : null}
        </span>
      ) : null}
    </div>
  );
}
