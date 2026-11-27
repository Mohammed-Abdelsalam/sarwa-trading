'use client';

import { RefreshCw, TriangleAlert } from 'lucide-react';
import { type Route } from 'next';
import NextLink from 'next/link';

import { Button, cn, StateView } from '@sarwa/ui';

import { ChartToolbar } from './chart-toolbar';
import { KeyStats, PriceSummary, RangeCard, SimilarStocks } from './detail-parts';
import { PriceChart } from './price-chart';
import { RemovedStock } from './removed-stock';
import { useStockDetailPage } from './use-stock-detail-page';

const TONE = { up: 'text-pos', down: 'text-neg', flat: 'text-fg-2' } as const;

// The live part of the stock page: the server renders the heading and the order panel beside it.
export function StockDetailBody({ symbol }: { symbol: string }) {
  const page = useStockDetailPage(symbol);
  const { quote, stats, week52, chart, labels, actions } = page;

  if (page.notFound) {
    return <RemovedStock symbol={symbol} watched={page.watched} onRemove={actions.toggleWatch} />;
  }
  if (page.isError) {
    return (
      <StateView
        tone="neg"
        icon={<TriangleAlert />}
        title={labels.loadError}
        description={labels.loadErrorBody}
        action={
          <Button variant="secondary" icon={<RefreshCw className="size-4" />} onClick={page.retry}>
            {labels.retry}
          </Button>
        }
      />
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
        <PriceSummary quote={quote} live={page.live} />
        {page.quoteLine ? (
          <span className="type-sm text-fg-3 mb-3 tabular-nums">{page.quoteLine}</span>
        ) : null}
      </div>

      <PriceChart
        symbol={symbol}
        period={chart.period}
        type={chart.type}
        height={300}
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

      {page.position ? (
        <section className="border-border bg-surface flex flex-col gap-3 rounded-lg border px-4.5 py-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="type-h3">{page.position.title}</h2>
            {page.position.openOrders ? (
              <NextLink
                href={`/orders?symbol=${symbol}` as Route}
                className="type-sm text-brand-fg font-semibold"
              >
                {page.position.openOrders}
              </NextLink>
            ) : null}
          </div>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {page.position.stats.map((stat) => (
              <div key={stat.label}>
                <dt className="type-caption text-fg-3">{stat.label}</dt>
                <dd className={cn('type-num-md', stat.direction && TONE[stat.direction])}>
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {stats ? <KeyStats stats={stats} layout="grid" /> : null}
      {week52 ? <RangeCard {...week52} /> : null}
      <SimilarStocks title={labels.similar} stocks={page.similar} />
    </>
  );
}
