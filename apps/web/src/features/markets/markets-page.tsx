'use client';

import { ArrowDown, ArrowUp, ArrowUpDown, RefreshCw, Search, WifiOff } from 'lucide-react';

import { SECTOR_FILTERS, sectorFilterLabel, sortLabel, useI18n } from '@sarwa/core';
import { Button, Chip, Input, Kbd, StateView } from '@sarwa/ui';

import { StockListSkeleton } from '../../components/trading/stock-row';
import { StockList } from './stock-list';
import { StockPreview } from './stock-preview';
import { useMarketsPage } from './use-markets-page';

export function MarketsPage() {
  const { t, f } = useI18n();
  const page = useMarketsPage();
  const { filters, actions } = page;
  const SortIcon = filters.sort.dir > 0 ? ArrowUp : ArrowDown;
  const sort = sortLabel(t, filters.sort);

  return (
    <div className="flex min-h-0 flex-1">
      <section
        aria-label={t.markets.stocks}
        className="bg-surface border-border flex w-full min-w-0 flex-col lg:w-110 lg:min-w-95 lg:shrink-0 lg:border-e"
      >
        <div className="flex flex-col gap-3.5 px-4 pt-4 pb-3 md:px-5 md:pt-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="type-h2">{t.markets.title}</h1>
              <p className="type-caption text-fg-3 tabular-nums">
                {t.markets.summary(f.count(page.rows.length))}
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              aria-label={t.sort.clickToChange({
                label: sort,
                order: filters.sort.dir > 0 ? t.sort.ascending : t.sort.descending,
              })}
              icon={<ArrowUpDown aria-hidden className="text-fg-3 size-4" />}
              onClick={actions.cycleSort}
            >
              {sort}
              <SortIcon aria-hidden className="text-fg-3 size-3.5" />
            </Button>
          </div>
          <form
            role="search"
            className="relative"
            onSubmit={(event) => {
              event.preventDefault();
            }}
          >
            <Input
              id="markets-search"
              icon={<Search />}
              value={page.search}
              onChange={(event) => {
                actions.setQuery(event.target.value);
              }}
              placeholder={t.search.placeholder}
              aria-label={t.search.title}
              autoComplete="off"
              className="pe-10"
            />
            <Kbd className="absolute end-2 top-1/2 -translate-y-1/2">/</Kbd>
          </form>
          <div
            role="group"
            aria-label={t.markets.sector}
            className="flex gap-2 overflow-x-auto max-md:-mx-4 max-md:px-4 md:flex-wrap"
          >
            {SECTOR_FILTERS.map((sector) => (
              <Chip
                key={sector}
                aria-pressed={sector === filters.sector}
                active={sector === filters.sector}
                className="h-8"
                onClick={() => {
                  actions.setSector(sector);
                }}
              >
                {sectorFilterLabel(t, sector)}
              </Chip>
            ))}
          </div>
        </div>

        {page.isLoading ? (
          <StockListSkeleton rows={10} />
        ) : page.isError ? (
          <StateView
            tone="neg"
            icon={<WifiOff />}
            title={t.markets.loadError}
            description={t.markets.loadErrorBody}
            action={
              <Button
                size="lg"
                icon={<RefreshCw aria-hidden className="size-4" />}
                onClick={actions.refresh}
              >
                {t.common.retry}
              </Button>
            }
          />
        ) : page.rows.length === 0 ? (
          <StateView
            icon={<Search />}
            title={t.search.noMatches({ query: filters.query })}
            description={t.markets.noMatchesBody({ sector: filters.sectorLabel })}
            action={
              <Button variant="secondary" onClick={actions.clearFilters}>
                {t.markets.clearSearch}
              </Button>
            }
          />
        ) : (
          <StockList
            label={t.markets.stocks}
            rows={page.rows}
            watched={page.watched}
            selected={page.selected}
            stale={page.stale}
            rowHref={page.rowHref}
            onSelect={actions.select}
            onOpen={page.twoPane ? actions.open : undefined}
            onToggleWatch={actions.toggleWatch}
          />
        )}
      </section>

      {page.preview ? <StockPreview symbol={page.preview} className="max-lg:hidden" /> : null}
    </div>
  );
}
