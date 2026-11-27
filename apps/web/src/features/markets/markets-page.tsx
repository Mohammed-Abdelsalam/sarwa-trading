'use client';

import { ArrowDown, ArrowUp, ArrowUpDown, RefreshCw, Search, WifiOff } from 'lucide-react';

import { SECTOR_FILTERS } from '@sarwa/core';
import { Button, Chip, StateView } from '@sarwa/ui';

import { StockListSkeleton } from '../../components/trading/stock-row';
import { StockList } from './stock-list';
import { StockPreview } from './stock-preview';
import { useMarketsPage } from './use-markets-page';

export function MarketsPage() {
  const page = useMarketsPage();
  const { filters, actions } = page;
  const SortIcon = filters.sort.dir > 0 ? ArrowUp : ArrowDown;

  return (
    <div className="flex min-h-0 flex-1">
      <section
        aria-label="Stocks"
        className="bg-surface border-border flex w-full min-w-0 flex-col lg:w-110 lg:min-w-95 lg:shrink-0 lg:border-r"
      >
        <div className="flex flex-col gap-3.5 px-4 pt-4 pb-3 md:px-5 md:pt-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="type-h2">Markets</h1>
              <p className="type-caption text-fg-3 tabular-nums">
                {page.rows.length} stocks · US equities · USD
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              aria-label={`Sort by ${filters.sort.label}, ${filters.sort.dir > 0 ? 'ascending' : 'descending'}. Click to change`}
              icon={<ArrowUpDown aria-hidden className="text-fg-3 size-4" />}
              onClick={actions.cycleSort}
            >
              {filters.sort.label}
              <SortIcon aria-hidden className="text-fg-3 size-3.5" />
            </Button>
          </div>
          <div
            role="tablist"
            aria-label="Sector"
            className="flex gap-2 overflow-x-auto max-md:-mx-4 max-md:px-4 md:flex-wrap"
          >
            {SECTOR_FILTERS.map((chip) => (
              <Chip
                key={chip.id}
                role="tab"
                aria-selected={chip.id === filters.sector}
                active={chip.id === filters.sector}
                className="h-8"
                onClick={() => {
                  actions.setSector(chip.id);
                }}
              >
                {chip.label}
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
            title="Couldn't load markets"
            description="We couldn't reach the price server. Check your connection — we'll keep trying in the background."
            action={
              <Button
                size="lg"
                icon={<RefreshCw aria-hidden className="size-4" />}
                onClick={actions.refresh}
              >
                Retry
              </Button>
            }
          />
        ) : page.rows.length === 0 ? (
          <StateView
            icon={<Search />}
            title={`No matches for “${filters.query}”`}
            description={`Try a ticker like AAPL or a company name like “Netflix”. Sector filter: ${filters.sectorLabel}.`}
            action={
              <Button variant="secondary" onClick={actions.clearFilters}>
                Clear search
              </Button>
            }
          />
        ) : (
          <StockList
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

      {page.twoPane && page.selected ? <StockPreview symbol={page.selected} /> : null}
    </div>
  );
}
