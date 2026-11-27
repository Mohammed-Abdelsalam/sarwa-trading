'use client';

import { LayoutGrid, List, RefreshCw, Star, TriangleAlert } from 'lucide-react';
import { type Route } from 'next';

import { formatPct, SORTS, WATCHLIST_ORDER_LABEL } from '@sarwa/core';
import { Button, ChangePill, SegmentedControl, StateView, Toast } from '@sarwa/ui';

import { StockListSkeleton, StockRow } from '../../components/trading/stock-row';
import { useWatchlistPage } from './use-watchlist-page';
import { EmptyWatchlist, WatchlistGrid, WatchlistTable } from './watchlist-views';

const VIEW_OPTIONS = [
  { value: 'table', label: 'Table view', icon: <List aria-hidden /> },
  { value: 'grid', label: 'Grid view', icon: <LayoutGrid aria-hidden /> },
] as const;

const SORT_OPTIONS = [
  { value: 'added', label: WATCHLIST_ORDER_LABEL },
  ...SORTS.map((sort, i) => ({
    value: String(i),
    label: `${sort.label} ${sort.dir > 0 ? '↑' : '↓'}`,
  })),
];

export function WatchlistPage() {
  const page = useWatchlistPage();
  const { actions } = page;
  const hasRows = page.rows.length > 0;

  return (
    <div className="relative mx-auto flex w-full max-w-310 flex-col gap-5 pt-4 pb-10 md:px-8 md:pt-7">
      <div className="flex flex-wrap items-end justify-between gap-4 px-4 md:px-0">
        <div>
          <h1 className="type-h1">Watchlist</h1>
          {hasRows ? (
            <p className="type-sm text-fg-2 mt-1 tabular-nums">
              {page.rows.length} {page.rows.length === 1 ? 'stock' : 'stocks'}
              {page.average === null ? null : (
                <>
                  {' · '}
                  <ChangePill
                    value={page.average}
                    label={formatPct(page.average)}
                    variant="inline"
                  />{' '}
                  average today
                </>
              )}
            </p>
          ) : null}
        </div>
        {hasRows ? (
          <div className="hidden items-center gap-2.5 md:flex">
            <select
              aria-label="Sort"
              value={page.sort ? String(SORTS.indexOf(page.sort)) : 'added'}
              onChange={(event) => {
                const option = SORTS[Number(event.target.value)];
                actions.setSort(event.target.value === 'added' ? null : (option ?? null));
              }}
              className="type-sm border-border-strong bg-surface text-fg focus-visible:outline-focus h-9 cursor-pointer rounded-md border px-3 font-semibold focus-visible:outline-2"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <SegmentedControl
              label="View"
              options={VIEW_OPTIONS}
              value={page.view}
              onChange={actions.setView}
            />
          </div>
        ) : null}
      </div>

      {page.isLoading ? (
        <StockListSkeleton rows={4} />
      ) : page.isError ? (
        <StateView
          tone="neg"
          icon={<TriangleAlert />}
          title="Couldn't load your watchlist"
          description="We couldn't reach the price server. Check your connection and try again."
          action={
            <Button
              variant="secondary"
              icon={<RefreshCw aria-hidden className="size-4" />}
              onClick={actions.retry}
            >
              Retry
            </Button>
          }
        />
      ) : !hasRows ? (
        <EmptyWatchlist />
      ) : (
        <>
          <div role="list" aria-label="Watchlist" className="border-border border-y md:hidden">
            {page.rows.map((stock) => (
              <StockRow
                key={stock.symbol}
                stock={stock}
                href={`/stocks/${stock.symbol}` as Route}
                watched
                stale={page.stale}
              />
            ))}
          </div>
          <div className="hidden md:block">
            {page.view === 'table' ? (
              <WatchlistTable
                rows={page.rows}
                stale={page.stale}
                sort={page.sort}
                onSort={actions.sortBy}
                onRemove={actions.remove}
              />
            ) : (
              <WatchlistGrid rows={page.rows} onRemove={actions.remove} />
            )}
          </div>
        </>
      )}

      {page.removed ? (
        <Toast
          className="fixed right-6 bottom-6 z-40"
          icon={<Star aria-hidden className="text-fg-3" />}
          title={`${page.removed} removed from Watchlist`}
          action={
            <Button variant="ghost" size="sm" className="text-brand-fg" onClick={actions.undo}>
              Undo
            </Button>
          }
          onDismiss={actions.dismissUndo}
        />
      ) : null}
    </div>
  );
}
