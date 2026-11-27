'use client';

import { Briefcase, Download, Info, RefreshCw, TriangleAlert } from 'lucide-react';
import Link from 'next/link';

import { DIRECTION_ARROW } from '@sarwa/core';
import {
  AllocationBar,
  Button,
  buttonVariants,
  Card,
  cn,
  Dialog,
  EstimateRows,
  PeriodTabs,
  Skeleton,
  StateView,
} from '@sarwa/ui';

import { EquityChart } from '../../components/trading/equity-chart';
import { PositionsTable } from './positions-table';
import { usePortfolioPage } from './use-portfolio-page';

const TONE = { up: 'text-pos', down: 'text-neg', flat: 'text-fg-2' } as const;

export function PortfolioPage() {
  const page = usePortfolioPage();
  const { labels, actions, summary } = page;

  if (page.isError) {
    return (
      <StateView
        className="py-24"
        tone="neg"
        icon={<TriangleAlert />}
        title={labels.loadError}
        description={labels.loadErrorBody}
        action={
          <Button
            variant="secondary"
            icon={<RefreshCw aria-hidden className="size-4" />}
            onClick={actions.retry}
          >
            {labels.retry}
          </Button>
        }
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-330 flex-col gap-5 px-4 py-6 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="type-sm text-fg-2 font-semibold">{labels.title}</h1>
          {summary ? (
            <>
              <p className="type-display max-md:text-4xl">{summary.equity}</p>
              <p className="type-sm">
                <span className={cn('font-semibold', TONE[summary.todayDirection])}>
                  <span aria-hidden>{DIRECTION_ARROW[summary.todayDirection]} </span>
                  {summary.today} ({summary.todayPct})
                </span>{' '}
                <span className="text-fg-3">{labels.today}</span> ·{' '}
                <span className={cn('font-semibold', TONE[summary.allTimeDirection])}>
                  {summary.allTime} ({summary.allTimePct})
                </span>{' '}
                <span className="text-fg-3">{labels.sinceStart(summary.start)}</span>
              </p>
            </>
          ) : (
            <Skeleton className="mt-2 h-18 w-80" />
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            icon={<Download aria-hidden className="size-4" />}
            disabled={page.rows.length === 0}
            onClick={actions.exportCsv}
          >
            {labels.exportCsv}
          </Button>
          <Button
            variant="ghost"
            icon={<Info aria-hidden className="size-4" />}
            onClick={() => {
              actions.setPlOpen(true);
            }}
          >
            {labels.howPl}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22.5rem]">
        <Card className="min-w-0 pt-3.5 pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-1.5">
            <PeriodTabs value={page.period} onChange={actions.setPeriod} label={labels.period} />
            <span className="type-sm text-fg-3">{labels.equityChart}</span>
          </div>
          <EquityChart
            values={page.curve.values}
            loading={page.curve.loading}
            height={220}
            label={labels.equityChart}
          />
        </Card>
        <Card className="flex flex-col gap-3 px-4.5 py-4">
          {summary ? (
            <>
              <EstimateRows
                dense
                rows={[
                  { label: labels.cash, value: summary.cash },
                  { label: labels.reserved, value: summary.reserved },
                  { label: labels.buyingPower, value: summary.buyingPower },
                  {
                    label: labels.unrealized,
                    value: (
                      <span className={TONE[summary.unrealizedDirection]}>
                        {summary.unrealized}
                      </span>
                    ),
                  },
                  {
                    label: labels.realized,
                    value: (
                      <span className={TONE[summary.realizedDirection]}>{summary.realized}</span>
                    ),
                  },
                ]}
              />
              <hr className="border-border" />
              <h2 className="type-overline text-fg-3">{labels.allocation}</h2>
              <AllocationBar segments={summary.allocation} label={labels.allocationA11y} />
            </>
          ) : (
            <Skeleton className="h-60" />
          )}
        </Card>
      </div>

      <Card className="overflow-hidden">
        <h2 className="type-h3 px-4.5 pt-4 pb-2">{labels.positions}</h2>
        {page.isLoading ? (
          <Skeleton className="m-4 h-40" />
        ) : page.rows.length === 0 ? (
          <StateView
            icon={<Briefcase />}
            title={labels.emptyTitle}
            description={labels.empty}
            action={
              <Link href="/markets" className={buttonVariants({ variant: 'secondary' })}>
                {labels.browse}
              </Link>
            }
          />
        ) : (
          <PositionsTable
            rows={page.rows}
            columns={labels.columns}
            buyLabel={labels.buy}
            sellLabel={labels.sell}
            sortDirection={page.sortDirection}
            onSort={actions.sortBy}
            onBuy={actions.buy}
            onSell={actions.sell}
          />
        )}
      </Card>

      <Dialog
        open={page.plOpen}
        onOpenChange={actions.setPlOpen}
        title={labels.howPlA11y}
        footer={
          <Button
            variant="secondary"
            onClick={() => {
              actions.setPlOpen(false);
            }}
          >
            {labels.close}
          </Button>
        }
      >
        <p className="type-body text-fg-2">{labels.howPlBody}</p>
      </Dialog>
    </div>
  );
}
