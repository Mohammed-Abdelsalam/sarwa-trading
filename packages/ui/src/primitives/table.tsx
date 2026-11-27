import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { type ComponentProps } from 'react';

import { cn } from '../lib/cn';

type Align = 'start' | 'end';

export function Table({ className, ...props }: ComponentProps<'table'>) {
  return (
    <table
      className={cn('w-full border-separate border-spacing-0 text-sm leading-5', className)}
      {...props}
    />
  );
}

export function THead(props: ComponentProps<'thead'>) {
  return <thead {...props} />;
}

export function TBody({ className, ...props }: ComponentProps<'tbody'>) {
  return <tbody className={cn('[&>tr:last-child>td]:border-b-0', className)} {...props} />;
}

export function TRow({
  interactive = false,
  className,
  ...props
}: ComponentProps<'tr'> & { interactive?: boolean }) {
  return (
    <tr
      className={cn(
        interactive && 'hover:[&>td]:bg-surface-3 cursor-pointer [&>td]:transition-colors',
        className,
      )}
      {...props}
    />
  );
}

const headCell =
  'border-border bg-surface text-fg-3 h-10 whitespace-nowrap border-b px-3 text-xs font-semibold tracking-[0.02em]';

export function TH({
  align = 'start',
  className,
  ...props
}: Omit<ComponentProps<'th'>, 'align'> & { align?: Align }) {
  return (
    <th
      scope="col"
      className={cn(headCell, align === 'end' ? 'text-end' : 'text-start', className)}
      {...props}
    />
  );
}

export function TCell({
  align = 'start',
  className,
  ...props
}: Omit<ComponentProps<'td'>, 'align'> & { align?: Align }) {
  return (
    <td
      className={cn(
        'border-border h-13 border-b px-3 align-middle whitespace-nowrap',
        align === 'end' ? 'text-end tabular-nums' : 'text-start',
        className,
      )}
      {...props}
    />
  );
}

export type SortDirection = 'ascending' | 'descending' | 'none';

export function SortHeader({
  label,
  direction,
  onSort,
  align = 'start',
  className,
}: {
  label: string;
  direction: SortDirection;
  onSort: () => void;
  align?: Align;
  className?: string;
}) {
  const Icon = direction === 'none' ? ArrowUpDown : direction === 'ascending' ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={direction === 'none' ? undefined : direction}
      className={cn(headCell, align === 'end' ? 'text-end' : 'text-start', className)}
    >
      <button
        type="button"
        onClick={onSort}
        className={cn(
          'focus-visible:outline-focus hover:text-fg-2 inline-flex cursor-pointer items-center gap-1 rounded-xs focus-visible:outline-2',
          direction !== 'none' && 'text-fg',
        )}
      >
        {label}
        <Icon aria-hidden className="size-3.5" />
      </button>
    </th>
  );
}
