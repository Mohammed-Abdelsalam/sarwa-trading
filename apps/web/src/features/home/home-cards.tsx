'use client';

import { type Route } from 'next';
import Link from 'next/link';

import { DIRECTION_ARROW } from '@sarwa/core';
import { Card, cn, Heatmap, SegmentedControl } from '@sarwa/ui';

import { RouteLink } from '../../components/route-link';
import { StockListSkeleton, StockRow } from '../../components/trading/stock-row';
import { type HeatmapView, type MoversTab, type useHomePage } from './use-home-page';

type HomeView = ReturnType<typeof useHomePage>;
// The market cards both Home modes show: guests above the fold, members beside their equity.
export type MarketCardsView = Pick<HomeView, 'heatmap' | 'movers' | 'labels' | 'actions'>;

const TONE = { up: 'text-pos', down: 'text-neg', flat: 'text-fg-2' } as const;

export function HeatmapCard({ page }: { page: MarketCardsView }) {
  const { labels, actions } = page;
  return (
    <Card className="flex flex-col gap-2.5 px-4.5 pt-4 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="type-h3">{labels.heatmap}</h2>
        <div className="flex items-center gap-3">
          <span className="type-caption text-fg-3 max-sm:hidden">{labels.heatmapHint}</span>
          <SegmentedControl<HeatmapView>
            label={labels.heatmapView}
            value={page.heatmap.view}
            onChange={actions.setHeatmapView}
            options={[
              { value: 'map', label: labels.map },
              { value: 'list', label: labels.list },
            ]}
          />
        </div>
      </div>
      {page.heatmap.view === 'map' ? (
        <Heatmap
          tiles={page.heatmap.tiles}
          label={labels.heatmap}
          largeAt={0.08}
          tileHref={(symbol) => `/stocks/${symbol}`}
          link={RouteLink}
        />
      ) : (
        <ul aria-label={labels.heatmap} className="flex flex-col">
          {page.heatmap.rows.map((row) => (
            <li
              key={row.key}
              className="border-border type-sm flex h-10 items-center justify-between border-b last:border-b-0"
            >
              <Link href={`/stocks/${row.key}` as Route} className="font-semibold">
                {row.label}
              </Link>
              <span className={cn('font-semibold tabular-nums', TONE[row.direction])}>
                <span aria-hidden>{DIRECTION_ARROW[row.direction]} </span>
                {row.changeLabel}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function MoversCard({ page }: { page: MarketCardsView }) {
  const { labels, actions } = page;
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 pt-3.5 pb-2">
        <h2 className="type-h3">{labels.movers}</h2>
        <SegmentedControl<MoversTab>
          label={labels.movers}
          value={page.movers.tab}
          onChange={actions.setMoversTab}
          options={[
            { value: 'gainers', label: labels.moverTabs.gainers },
            { value: 'losers', label: labels.moverTabs.losers },
            { value: 'active', label: labels.moverTabs.active },
          ]}
        />
      </div>
      {page.movers.isLoading ? (
        <StockListSkeleton rows={5} />
      ) : (
        <div role="list" aria-label={labels.moverTabs[page.movers.tab]}>
          {page.movers.rows.map((stock) => (
            <StockRow key={stock.symbol} stock={stock} href={`/stocks/${stock.symbol}` as Route} />
          ))}
        </div>
      )}
    </Card>
  );
}
