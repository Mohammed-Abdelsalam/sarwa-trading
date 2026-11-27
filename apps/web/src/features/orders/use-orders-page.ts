import { type Route } from 'next';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { type Order, type OrderFilter } from '@sarwa/contracts';
import {
  toTradeQuote,
  useCancelOrder,
  useOrderPages,
  useOrders,
  usePortfolio,
  useStocks,
  useTradingStatus,
} from '@sarwa/core';

import { replaceSearchParam, useSearchParam } from '../../lib/browser';
import { downloadCsv, toCsv } from '../../lib/csv';
import { type Copy, useCopy } from '../../lib/i18n';
import { CANCELLABLE, orderDetail, orderSizeLabel, orderTime, orderTypeLabel } from './order-copy';

const FILTERS: readonly OrderFilter[] = ['open', 'filled', 'all'];
export const RANGES = ['1', '7', '30', 'all'] as const;
export type DateRange = (typeof RANGES)[number];
const DAY_MS = 86_400_000;

export function parseFilter(value: string | null): OrderFilter {
  return FILTERS.find((filter) => filter === value) ?? 'all';
}

export function parseRange(value: string | null): DateRange {
  return RANGES.find((range) => range === value) ?? '7';
}

export function orderRow(order: Order, lastTicks: number | null, now: number, copy: Copy) {
  const { t } = copy;
  return {
    id: order.id,
    symbol: order.symbol,
    side: order.side,
    sideLabel: t.common.sides[order.side],
    type: orderTypeLabel(order, copy),
    size: orderSizeLabel(order, copy),
    status: order.status,
    statusLabel: t.orderStatus[order.status],
    detail: orderDetail(order, lastTicks, copy),
    time: orderTime(order.createdAt, now, copy),
    cancellable: CANCELLABLE.includes(order.status),
  };
}

export type OrderRow = ReturnType<typeof orderRow>;

export function ordersCsv(rows: readonly OrderRow[], { t }: Copy): string {
  const c = t.csv.orders;
  return toCsv(
    [c.id, c.side, c.symbol, c.type, c.size, c.status, c.detail, c.time],
    rows.map((r) => [r.id, r.sideLabel, r.symbol, r.type, r.size, r.statusLabel, r.detail, r.time]),
  );
}

export function useOrdersPage(routeOrderId?: string) {
  const copy = useCopy();
  const { t, f, m } = copy;
  const router = useRouter();
  const filter = parseFilter(useSearchParam('status'));
  const symbol = useSearchParam('symbol') ?? '';
  const range = parseRange(useSearchParam('range'));
  const selected = useSearchParam('order') ?? routeOrderId ?? null;
  const orders = useOrderPages({ filter });
  const open = useOrders({ filter: 'open' });
  const stocks = useStocks();
  const portfolio = usePortfolio();
  const session = useTradingStatus().data?.session;
  const cancel = useCancelOrder();
  const [now] = useState(() => Date.now());

  const { items } = orders;
  const lastTicks = new Map(
    (stocks.data ?? []).map((stock) => [stock.symbol, toTradeQuote(stock.quote).lastTicks]),
  );
  const since = range === 'all' ? 0 : now - Number(range) * DAY_MS;
  const rows = items
    .filter((order) => (!symbol || order.symbol === symbol) && order.createdAt >= since)
    .map((order) => ({
      ...orderRow(order, lastTicks.get(order.symbol) ?? null, now, copy),
      cancelling: cancel.isPending && cancel.variables === order.id,
    }));
  const openCount = open.data?.items.length ?? 0;
  const outcome = cancel.data?.outcome;

  return {
    filter,
    symbol,
    range,
    rows,
    selected,
    isLoading: orders.isLoading,
    isError: orders.isError,
    hasMore: orders.hasMore,
    isLoadingMore: orders.isLoadingMore,
    symbols: [...new Set(items.map((order) => order.symbol))].sort(),
    summary:
      session && portfolio.reservedCents !== null
        ? t.orders.summary({
            ...f.count(openCount),
            reserved: f.money(portfolio.reservedCents),
            time: f.time(session.closesAt),
          })
        : null,
    notice:
      outcome === 'already_filled'
        ? {
            tone: 'info' as const,
            title: t.orders.alreadyFilledTitle,
            body: t.orders.alreadyFilledBody,
          }
        : outcome === 'canceled'
          ? { tone: 'neutral' as const, title: t.orders.canceled, body: '' }
          : cancel.isError
            ? { tone: 'neg' as const, title: m.orders.cancelError, body: '' }
            : null,
    labels: {
      title: t.orders.title,
      exportCsv: t.common.exportCsv,
      status: m.orders.statusFilter,
      tabs: {
        open: t.orders.openTab(f.count(openCount)),
        filled: t.orders.filledTab,
        all: t.orders.allTab,
      },
      symbolFilter: m.orders.symbolFilter,
      allSymbols: t.orders.allSymbols,
      dateFilter: m.orders.dateFilter,
      ranges: {
        '1': t.orders.lastDays(f.count(1)),
        '7': t.orders.lastDays(f.count(7)),
        '30': t.orders.lastDays(f.count(30)),
        all: m.orders.allTime,
      },
      columns: t.orders.columns,
      cancel: t.common.cancel,
      cancelA11y: (sym: string) => m.orders.cancelA11y({ symbol: sym }),
      openA11y: (id: string) => m.orders.openA11y({ id }),
      empty: t.orders.empty,
      emptyFiltered: m.orders.emptyFiltered,
      loadError: m.orders.loadError,
      retry: t.common.retry,
      dismiss: t.common.dismiss,
      loadMore: m.list.loadMore,
    },
    actions: {
      setFilter: (next: OrderFilter) => {
        replaceSearchParam('status', next === 'all' ? null : next);
      },
      setSymbol: (next: string) => {
        replaceSearchParam('symbol', next || null);
      },
      setRange: (next: DateRange) => {
        replaceSearchParam('range', next === '7' ? null : next);
      },
      retry: orders.refresh,
      loadMore: orders.loadMore,
      exportCsv: () => {
        downloadCsv(m.orders.exportFile, ordersCsv(rows, copy));
      },
      cancel: (id: string) => {
        cancel.mutate(id);
      },
      dismissNotice: cancel.reset,
      select: (id: string) => {
        if (routeOrderId) router.replace(`/orders/${id}` as Route);
        else replaceSearchParam('order', id);
      },
      closeDetail: () => {
        if (routeOrderId) router.replace('/orders');
        else replaceSearchParam('order', null);
      },
    },
  };
}
