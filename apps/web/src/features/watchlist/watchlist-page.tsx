'use client';

import { LayoutGrid, List, RefreshCw, Star, TriangleAlert } from 'lucide-react';
import { type Route } from 'next';
import Link from 'next/link';

import { formatPct, sortLabel, SORTS, useI18n } from '@sarwa/core';
import { Button, ChangePill, SegmentedControl, Select, StateView, Toast } from '@sarwa/ui';

import { StockListSkeleton, StockRow } from '../../components/trading/stock-row';
import { linkClass } from '../auth/auth-parts';
import { AUTH_ROUTES } from '../auth/auth-view';
import { useWatchlistPage } from './use-watchlist-page';
import { EmptyWatchlist, WatchlistGrid, WatchlistTable } from './watchlist-views';

export function WatchlistPage() {
  const { t, f } = useI18n();
  const viewOptions = [
    { value: 'table', label: t.watchlist.tableView, icon: <List aria-hidden /> },
    { value: 'grid', label: t.watchlist.gridView, icon: <LayoutGrid aria-hidden /> },
  ] as const;
  const sortOptions = [
    { value: 'added', label: sortLabel(t, null) },
    ...SORTS.map((sort, i) => ({
      value: String(i),
      label: `${sortLabel(t, sort)} ${sort.dir > 0 ? '↑' : '↓'}`,
    })),
  ];
  const page = useWatchlistPage();
  const { actions } = page;
  const hasRows = page.rows.length > 0;

  return (
    <div className="relative mx-auto flex w-full max-w-310 flex-col gap-5 pt-4 pb-10 md:px-8 md:pt-7">
      <div className="flex flex-wrap items-end justify-between gap-4 px-4 md:px-0">
        <div>
          <h1 className="type-h1">{t.watchlist.title}</h1>
          {hasRows ? (
            <p className="type-sm text-fg-2 mt-1 tabular-nums">
              {t.watchlist.count(f.count(page.rows.length))}
              {page.average === null ? null : (
                <>
                  {' · '}
                  <ChangePill
                    value={page.average}
                    label={formatPct(f, page.average)}
                    variant="inline"
                  />{' '}
                  {t.watchlist.averageToday}
                </>
              )}
            </p>
          ) : null}
        </div>
        {hasRows ? (
          <div className="hidden items-center gap-2.5 md:flex">
            <Select
              aria-label={t.sort.label}
              value={page.sort ? String(SORTS.indexOf(page.sort)) : 'added'}
              onChange={(event) => {
                const option = SORTS[Number(event.target.value)];
                actions.setSort(event.target.value === 'added' ? null : (option ?? null));
              }}
              className="h-9 font-semibold"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <SegmentedControl
              label={t.watchlist.view}
              options={viewOptions}
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
          title={t.watchlist.loadError}
          description={t.watchlist.loadErrorBody}
          action={
            <Button
              variant="secondary"
              icon={<RefreshCw aria-hidden className="size-4" />}
              onClick={actions.retry}
            >
              {t.common.retry}
            </Button>
          }
        />
      ) : !hasRows ? (
        <EmptyWatchlist />
      ) : (
        <>
          <div
            role="list"
            aria-label={t.watchlist.title}
            className="border-border border-y md:hidden"
          >
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

      {page.guest && !page.isLoading && !page.isError ? (
        <p className="type-sm text-fg-3 px-4 text-center md:px-0">
          {t.watchlist.guestNote}{' '}
          <Link href={AUTH_ROUTES.signUp} className={linkClass}>
            {t.gate.tabs.signUp}
          </Link>
        </p>
      ) : null}

      {page.removed ? (
        <Toast
          className="fixed end-6 bottom-6 z-40"
          icon={<Star aria-hidden className="text-fg-3" />}
          title={t.watchlist.removed({ symbol: page.removed })}
          action={
            <Button variant="ghost" size="sm" className="text-brand-fg" onClick={actions.undo}>
              {t.common.undo}
            </Button>
          }
          onDismiss={actions.dismissUndo}
          dismissLabel={page.dismissLabel}
        />
      ) : null}
    </div>
  );
}
