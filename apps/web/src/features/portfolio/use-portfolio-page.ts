import { type Route } from 'next';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { type EquityPeriod, type Sector } from '@sarwa/contracts';
import { cents, direction, POLICY, useEquityCurve, usePortfolio, useStocks } from '@sarwa/core';
import { type AllocationSegment, type SortDirection } from '@sarwa/ui';

import { downloadCsv, toCsv } from '../../lib/csv';
import { type Copy, useCopy } from '../../lib/i18n';

type Summary = NonNullable<ReturnType<typeof usePortfolio>['summary']>;
type Position = Summary['positions'][number];

export type PositionSortKey =
  | 'symbol'
  | 'qtyMicros'
  | 'averageCostTicks'
  | 'lastTicks'
  | 'marketValueCents'
  | 'todayCents'
  | 'totalReturnBps'
  | 'weightBps';

export interface PositionSort {
  key: PositionSortKey;
  dir: 1 | -1;
}

const DEFAULT_SORT: PositionSort = { key: 'marketValueCents', dir: -1 };

export function sortPositions(positions: readonly Position[], sort: PositionSort): Position[] {
  return [...positions].sort((a, b) => {
    const diff =
      sort.key === 'symbol' ? a.symbol.localeCompare(b.symbol) : a[sort.key] - b[sort.key];
    return diff * sort.dir;
  });
}

export function positionRow(position: Position, name: string | undefined, { f }: Copy) {
  return {
    symbol: position.symbol,
    name: name ?? '',
    sector: position.sector as Sector,
    shares: f.shares(position.qtyMicros),
    avgCost: f.price(position.averageCostTicks),
    last: f.price(position.lastTicks),
    marketValue: f.money(position.marketValueCents),
    today: f.money(position.todayCents, { signed: true }),
    todayDirection: direction(position.todayCents),
    total: f.money(position.unrealizedCents, { signed: true }),
    totalPct: f.percent(position.totalReturnBps, { signed: true }),
    totalDirection: direction(position.unrealizedCents),
    weight: f.percent(position.weightBps),
  };
}

export type PositionRow = ReturnType<typeof positionRow>;

export function positionsCsv(rows: readonly PositionRow[], { t }: Copy): string {
  const c = t.csv.portfolio;
  return toCsv(
    [
      c.symbol,
      c.shares,
      c.avgCost,
      c.last,
      c.marketValue,
      c.today,
      c.unrealized,
      c.totalReturn,
      c.weight,
    ],
    rows.map((row) => [
      row.symbol,
      row.shares,
      row.avgCost,
      row.last,
      row.marketValue,
      row.today,
      row.total,
      row.totalPct,
      row.weight,
    ]),
  );
}

export function allocationSegments(summary: Summary, { t, f }: Copy): AllocationSegment[] {
  return summary.allocation.map((slice) => {
    const cash = slice.key === 'cash';
    return {
      key: slice.key,
      label: cash ? t.portfolio.cash : t.sectors[slice.key as Sector],
      value: f.money(slice.cents),
      weight: slice.weightBps / 10_000,
      weightLabel: f.percent(slice.weightBps),
      colorRole: cash ? 'cash' : (slice.key as Sector),
    };
  });
}

export function usePortfolioPage() {
  const copy = useCopy();
  const { t, f, m } = copy;
  const router = useRouter();
  const portfolio = usePortfolio();
  const stocks = useStocks();
  const [period, setPeriod] = useState<EquityPeriod>('1D');
  const equity = useEquityCurve(period);
  const [sort, setSort] = useState<PositionSort>(DEFAULT_SORT);
  const [plOpen, setPlOpen] = useState(false);
  const { summary, books } = portfolio;
  const names = new Map((stocks.data ?? []).map((stock) => [stock.symbol, stock.name]));
  const rows = summary
    ? sortPositions(summary.positions, sort).map((p) => positionRow(p, names.get(p.symbol), copy))
    : [];
  const trade = (symbol: string, side: 'buy' | 'sell') => {
    router.push(`/stocks/${symbol}?trade=${side}` as Route);
  };

  return {
    isLoading: portfolio.isLoading,
    isError: portfolio.isError,
    period,
    plOpen,
    rows,
    sortDirection: (key: PositionSortKey): SortDirection =>
      sort.key === key ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none',
    summary: summary
      ? {
          equity: f.money(summary.equityCents),
          today: f.money(summary.todayCents, { signed: true }),
          todayPct: f.percent(summary.todayBps, { signed: true }),
          todayDirection: direction(summary.todayCents),
          allTime: f.money(summary.allTimeCents, { signed: true }),
          allTimePct: f.percent(summary.allTimeBps, { signed: true }),
          allTimeDirection: direction(summary.allTimeCents),
          start: f.money(cents(books?.account.startingCashCents ?? 0)),
          cash: f.money(summary.cashCents),
          reserved: f.money(summary.reservedCents),
          buyingPower: f.money(summary.buyingPowerCents),
          unrealized: f.money(summary.unrealizedCents, { signed: true }),
          unrealizedDirection: direction(summary.unrealizedCents),
          realized: f.money(summary.realizedYtdCents, { signed: true }),
          realizedDirection: direction(summary.realizedYtdCents),
          allocation: allocationSegments(summary, copy),
        }
      : null,
    curve: {
      values: equity.data?.points.map((point) => point.equityCents) ?? [],
      loading: equity.isPending,
    },
    labels: {
      title: t.portfolio.totalEquityPaper,
      today: t.portfolio.today,
      sinceStart: (amount: string) => t.portfolio.sinceStart({ amount }),
      exportCsv: t.common.exportCsv,
      howPl: t.portfolio.howPl,
      howPlA11y: t.portfolio.howPlA11y,
      howPlBody: t.portfolio.howPlBody,
      close: t.common.close,
      period: t.chart.period,
      equityChart: t.portfolio.equityChart({
        duration: t.common.minutes(f.count(POLICY.snapshotIntervalMs / 60_000)),
      }),
      cash: t.portfolio.cash,
      reserved: t.portfolio.reserved,
      buyingPower: t.portfolio.buyingPower,
      unrealized: t.portfolio.unrealizedPl,
      realized: t.portfolio.realizedPlYtd,
      allocation: t.portfolio.allocation,
      allocationA11y: t.portfolio.allocationA11y,
      positions: t.portfolio.positions(f.count(rows.length)),
      columns: t.portfolio.columns,
      buy: t.common.buy,
      sell: t.common.sell,
      empty: t.portfolio.empty,
      emptyTitle: m.portfolio.emptyTitle,
      loadError: m.portfolio.loadError,
      loadErrorBody: t.common.loadErrorBody,
      retry: t.common.retry,
      browse: t.nav.markets,
    },
    actions: {
      setPeriod,
      setPlOpen,
      retry: () => void portfolio.refresh(),
      sortBy: (key: PositionSortKey) => {
        setSort((current) =>
          current.key === key ? { key, dir: current.dir > 0 ? -1 : 1 } : { key, dir: -1 },
        );
      },
      exportCsv: () => {
        downloadCsv(m.portfolio.exportFile, positionsCsv(rows, copy));
      },
      buy: (symbol: string) => {
        trade(symbol, 'buy');
      },
      sell: (symbol: string) => {
        trade(symbol, 'sell');
      },
    },
  };
}
