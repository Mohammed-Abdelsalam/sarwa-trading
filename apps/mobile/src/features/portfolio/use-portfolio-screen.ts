import { useState } from 'react';

import { type EquityPeriod, EquityPeriodSchema, type Sector } from '@sarwa/contracts';
import {
  type Cents,
  direction,
  type Direction,
  useEquityCurve,
  usePortfolio,
  useStockIndex,
} from '@sarwa/core';

import { useCopy } from '../../lib/i18n';

export interface SignedValue {
  label: string;
  direction: Direction;
}

export function useEquitySeries(period: EquityPeriod) {
  const curve = useEquityCurve(period);
  const values = (curve.data?.points ?? []).map((point) => point.equityCents);
  return { values, rising: (values.at(-1) ?? 0) >= (values[0] ?? 0) };
}

export function usePortfolioScreen() {
  const copy = useCopy();
  const { t, f, m } = copy;
  const [period, setPeriod] = useState<EquityPeriod>('1D');
  const [explaining, setExplaining] = useState(false);
  const portfolio = usePortfolio();
  const curve = useEquitySeries(period);
  const { sectorOf } = useStockIndex();
  const summary = portfolio.summary;
  const signed = (amount: Cents): SignedValue => ({
    label: f.money(amount, { signed: true }),
    direction: direction(amount),
  });

  return {
    isLoading: portfolio.isLoading,
    isError: portfolio.isError,
    period,
    periods: EquityPeriodSchema.options,
    curve,
    explaining,
    summary: summary && {
      equity: f.money(summary.equityCents),
      today: {
        label: `${f.money(summary.todayCents, { signed: true })} (${f.percent(summary.todayBps, { signed: true })})`,
        direction: direction(summary.todayCents),
      },
      stats: [
        {
          key: 'cash',
          label: t.portfolio.cash,
          value: { label: f.money(summary.cashCents), direction: 'flat' as const },
        },
        {
          key: 'reserved',
          label: t.portfolio.reserved,
          value: { label: f.money(summary.reservedCents), direction: 'flat' as const },
        },
        {
          key: 'bp',
          label: t.portfolio.buyingPower,
          value: { label: f.money(summary.buyingPowerCents), direction: 'flat' as const },
        },
        { key: 'allTime', label: t.portfolio.allTime, value: signed(summary.allTimeCents) },
        {
          key: 'unrealized',
          label: t.portfolio.unrealized,
          value: signed(summary.unrealizedCents),
        },
        {
          key: 'realized',
          label: t.portfolio.realizedYtd,
          value: signed(summary.realizedYtdCents),
        },
      ],
      allocation: summary.allocation.map((slice) => ({
        key: slice.key,
        label: slice.key === 'cash' ? t.portfolio.cash : t.sectors[slice.key as Sector],
        share: slice.weightBps,
        pct: f.percent(slice.weightBps),
      })),
      positionsTitle: t.portfolio.positions(f.count(summary.positions.length)),
      positions: summary.positions.map((p) => ({
        symbol: p.symbol,
        sector: sectorOf(p.symbol),
        holding: m.sharesAvg({ shares: f.shares(p.qtyMicros), price: f.price(p.averageCostTicks) }),
        details: [
          `${t.portfolio.columns.last} ${f.price(p.lastTicks)}`,
          `${t.portfolio.columns.today} ${f.money(p.todayCents, { signed: true })}`,
          `${t.portfolio.columns.weight} ${f.percent(p.weightBps)}`,
        ].join(' · '),
        value: f.money(p.marketValueCents),
        total: {
          label: `${f.money(p.unrealizedCents, { signed: true })} (${f.percent(p.totalReturnBps, { signed: true })})`,
          direction: direction(p.unrealizedCents),
        },
      })),
    },
    actions: {
      setPeriod,
      retry: () => void portfolio.refresh(),
      explain: () => {
        setExplaining(true);
      },
      closeExplain: () => {
        setExplaining(false);
      },
    },
  };
}
