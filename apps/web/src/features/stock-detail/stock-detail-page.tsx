'use client';

import { Bell, RefreshCw, Star, TriangleAlert } from 'lucide-react';
import { type Route } from 'next';
import NextLink from 'next/link';

import {
  Badge,
  Breadcrumbs,
  Button,
  buttonVariants,
  cn,
  type LinkComponent,
  StateView,
  StockAvatar,
} from '@sarwa/ui';

import { OrderPanel } from '../trade/order-panel';
import { ChartToolbar } from './chart-toolbar';
import { KeyStats, PriceSummary, RangeCard, SimilarStocks } from './detail-parts';
import { PriceChart } from './price-chart';
import { RemovedStock } from './removed-stock';
import { useStockDetailPage } from './use-stock-detail-page';

const TONE = { up: 'text-pos', down: 'text-neg', flat: 'text-fg-2' } as const;

const Link: LinkComponent = ({ href, ...props }) => (
  <NextLink href={{ pathname: href }} {...props} />
);

export function StockDetailPage({ symbol }: { symbol: string }) {
  const page = useStockDetailPage(symbol);
  const { stock, quote, stats, week52, chart, labels, actions } = page;

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
    <div className="grid w-full gap-6 px-4 pt-4 pb-24 md:px-8 md:pt-5 xl:grid-cols-[minmax(0,1fr)_23.75rem] xl:items-start xl:pb-8">
      <div className="flex min-w-0 flex-col gap-4.5">
        <Breadcrumbs
          link={Link}
          items={[
            { label: labels.markets, href: '/markets' },
            ...(page.sectorLabel ? [{ label: page.sectorLabel }] : []),
            { label: symbol },
          ]}
        />

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
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
          <div className="flex gap-2">
            <NextLink
              href={`/alerts?new=${symbol}` as Route}
              className={buttonVariants({ variant: 'secondary' })}
            >
              <Bell aria-hidden className="size-4" />
              {labels.alert}
            </NextLink>
            <Button
              variant="secondary"
              aria-pressed={page.watched}
              aria-label={labels.watchA11y}
              icon={
                <Star
                  aria-hidden
                  className={page.watched ? 'text-star size-4 fill-current' : 'size-4'}
                />
              }
              onClick={actions.toggleWatch}
            >
              {labels.watch}
            </Button>
          </div>
        </div>

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
      </div>

      <OrderPanel symbol={symbol} />
    </div>
  );
}
