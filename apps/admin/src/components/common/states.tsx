import { ChevronLeft, ChevronRight, RefreshCw, TriangleAlert } from 'lucide-react';
import { type ReactNode } from 'react';

import { ApiError } from '@sarwa/core';
import { useAdminI18n } from '@sarwa/core/admin';
import { Button, cn, IconButton, Skeleton, StateView } from '@sarwa/ui';

export function TableSkeleton({
  rows = 6,
  columns,
  label,
}: {
  rows?: number;
  columns: number;
  label: string;
}) {
  return (
    <div aria-busy="true" aria-label={label} role="status">
      {Array.from({ length: rows }, (_, row) => (
        <div
          key={row}
          className="border-border grid h-13 items-center gap-6 border-b px-4"
          style={{ gridTemplateColumns: `repeat(${String(columns)}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }, (__, column) => (
            <Skeleton
              key={column}
              className={cn('h-3', column === 0 ? 'w-3/4' : column % 2 ? 'w-1/2' : 'w-2/3')}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function LoadError({
  what,
  onRetry,
  error,
  className,
}: {
  what: string;
  onRetry: () => void;
  // Support traces a failure by the server's request id.
  error?: unknown;
  className?: string;
}) {
  const { t } = useAdminI18n();
  const requestId = error instanceof ApiError ? error.requestId : null;
  return (
    <StateView
      className={cn('flex-1 justify-center', className)}
      tone="neg"
      icon={<TriangleAlert />}
      title={t.admin.states.loadError({ what })}
      description={t.admin.states.loadErrorBody}
      footnote={requestId ? t.admin.states.requestId({ id: requestId }) : undefined}
      action={
        <Button icon={<RefreshCw aria-hidden className="size-4" />} onClick={onRetry}>
          {t.admin.states.retry}
        </Button>
      }
    />
  );
}

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="type-h1 text-fg">{title}</h1>
        {subtitle ? <p className="type-sm text-fg-2 mt-1 tabular-nums">{subtitle}</p> : null}
      </div>
      {children ? (
        <div className="flex flex-wrap items-center gap-3 max-sm:w-full">{children}</div>
      ) : null}
    </div>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const { t, f } = useAdminI18n();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="border-border flex items-center justify-between gap-4 border-t px-4 py-2.5">
      <span className="type-sm text-fg-2 tabular-nums">
        {t.admin.states.showing({ from: f.number(from), to: f.number(to), total: f.number(total) })}
      </span>
      <nav aria-label={t.admin.states.pagination} className="flex items-center gap-1">
        <IconButton
          size={32}
          label={t.admin.states.previousPage}
          disabled={page <= 1}
          onClick={() => {
            onPage(page - 1);
          }}
        >
          <ChevronLeft aria-hidden className="size-4 rtl:-scale-x-100" />
        </IconButton>
        <span className="type-sm text-fg px-2 font-semibold tabular-nums" aria-current="page">
          {t.admin.states.page({ n: `${f.number(page)} / ${f.number(pages)}` })}
        </span>
        <IconButton
          size={32}
          label={t.admin.states.nextPage}
          disabled={page >= pages}
          onClick={() => {
            onPage(page + 1);
          }}
        >
          <ChevronRight aria-hidden className="size-4 rtl:-scale-x-100" />
        </IconButton>
      </nav>
    </div>
  );
}

export function BarList({
  items,
  label,
}: {
  items: readonly { key: string; label: ReactNode; value: string; weight: number }[];
  label: string;
}) {
  return (
    <ul aria-label={label} className="flex flex-col gap-2.5">
      {items.map((item) => (
        <li
          key={item.key}
          className="grid grid-cols-[9.5rem_minmax(0,1fr)_4rem] items-center gap-3.5"
        >
          <span className="min-w-0 truncate">{item.label}</span>
          <span aria-hidden className="bg-surface-3 h-6 overflow-hidden rounded-md">
            <span
              className="bg-brand block h-full rounded-md"
              style={{ width: `${String(Math.round(Math.min(1, item.weight) * 100))}%` }}
            />
          </span>
          <span className="type-num-sm text-end font-semibold">{item.value}</span>
        </li>
      ))}
    </ul>
  );
}
