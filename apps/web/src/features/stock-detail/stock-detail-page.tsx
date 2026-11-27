'use client';

import { RefreshCw, Star, TriangleAlert } from 'lucide-react';
import NextLink from 'next/link';

import {
  Badge,
  Breadcrumbs,
  Button,
  type LinkComponent,
  StateView,
  StockAvatar,
  starLabel,
} from '@sarwa/ui';

import { ChartToolbar } from './chart-toolbar';
import { KeyStats, PriceSummary, RangeCard, SimilarStocks } from './detail-parts';
import { PriceChart } from './price-chart';
import { RemovedStock } from './removed-stock';
import { useStockDetailPage } from './use-stock-detail-page';

const Link: LinkComponent = ({ href, ...props }) => (
  <NextLink href={{ pathname: href }} {...props} />
);

export function StockDetailPage({ symbol }: { symbol: string }) {
  const page = useStockDetailPage(symbol);
  const { stock, quote, stats, week52, chart, actions } = page;

  if (page.notFound) {
    return <RemovedStock symbol={symbol} watched={page.watched} onRemove={actions.toggleWatch} />;
  }
  if (page.isError) {
    return (
      <StateView
        tone="neg"
        icon={<TriangleAlert />}
        title={`Couldn't load ${symbol}`}
        description="Check your connection and try again."
        action={
          <Button variant="secondary" icon={<RefreshCw className="size-4" />} onClick={page.retry}>
            Retry
          </Button>
        }
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-310 flex-col gap-5 px-4 pt-4 pb-10 md:px-8 md:pt-6">
      <Breadcrumbs
        link={Link}
        items={[
          { label: 'Markets', href: '/' },
          ...(page.sectorLabel ? [{ label: page.sectorLabel }] : []),
          { label: symbol },
        ]}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {stock ? <StockAvatar symbol={symbol} sector={stock.sector} size={56} /> : null}
          <div>
            <h1 className="type-h1">{stock?.name ?? symbol}</h1>
            <div className="type-sm text-fg-2 flex items-center gap-2">
              <b className="text-fg">{symbol}</b>
              {stock ? <Badge square>{stock.exchange}</Badge> : null}
              {page.sectorLabel ? <Badge>{page.sectorLabel}</Badge> : null}
            </div>
          </div>
        </div>
        <Button
          variant={page.watched ? 'secondary' : 'primary'}
          aria-pressed={page.watched}
          aria-label={starLabel(symbol, page.watched)}
          icon={
            <Star
              aria-hidden
              className={page.watched ? 'text-star size-4 fill-current' : 'size-4'}
            />
          }
          onClick={actions.toggleWatch}
        >
          {page.watched ? 'In watchlist' : 'Add to watchlist'}
        </Button>
      </div>

      <PriceSummary quote={quote} live={page.live} />

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <PriceChart
            symbol={symbol}
            period={chart.period}
            type={chart.type}
            toolbar={(change) => (
              <ChartToolbar
                period={chart.period}
                enabledPeriods={chart.enabledPeriods}
                onPeriodChange={actions.setPeriod}
                change={change}
                type={chart.type}
                onTypeChange={actions.setChartType}
              />
            )}
          />
        </div>
        <aside className="flex flex-col gap-4 lg:w-85 lg:shrink-0">
          {stats ? <KeyStats stats={stats} layout="list" /> : null}
          {week52 ? <RangeCard {...week52} /> : null}
        </aside>
      </div>

      <SimilarStocks title={`More in ${page.sectorLabel ?? 'this sector'}`} stocks={page.similar} />
    </div>
  );
}
