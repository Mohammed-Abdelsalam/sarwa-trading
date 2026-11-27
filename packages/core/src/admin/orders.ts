import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { type AdminOrder, type AdminOrdersQuery, type AdminOrderStats } from '@sarwa/contracts';
import {
  cents,
  type Cents,
  micros,
  notionalCents,
  type OrderStatus,
  ratioBps,
  ticks,
} from '@sarwa/domain';

import { adminKeys } from './keys';
import { STATS_REFRESH_MS } from './market';
import { useAdmin } from './provider';

export const ORDER_STREAM_LIMIT = 50;

// Newest first: an update replaces its row in place, a new order goes on top, a late older event is dropped.
export function mergeOrder(
  items: readonly AdminOrder[],
  order: AdminOrder,
  status?: OrderStatus,
  limit = ORDER_STREAM_LIMIT,
): AdminOrder[] {
  const index = items.findIndex((item) => item.id === order.id);
  const cached = items[index];
  if (cached && cached.updatedAt > order.updatedAt) return [...items];
  const next =
    index === -1 ? [order, ...items] : items.map((item, i) => (i === index ? order : item));
  return next.filter((item) => !status || item.status === status).slice(0, limit);
}

// Amount orders know their dollars up front; share orders use what filled, else the quoted price.
export function orderNotionalCents(
  order: Pick<
    AdminOrder,
    'amountCents' | 'filledNotionalCents' | 'qtyMicros' | 'limitTicks' | 'quotedTicks'
  >,
): Cents {
  if (order.amountCents !== null) return cents(order.amountCents);
  if (order.filledNotionalCents > 0) return cents(order.filledNotionalCents);
  return notionalCents(
    micros(order.qtyMicros ?? 0),
    ticks(order.limitTicks ?? order.quotedTicks),
    'nearest',
  );
}

// Bar rows for the stats panels: each row's share of the total and its bar length.
export function orderStatsBreakdown(stats: AdminOrderStats | undefined) {
  const rejections = [...(stats?.rejectionsByReason ?? [])].sort((a, b) => b.count - a.count);
  const rejectedTotal = rejections.reduce((sum, row) => sum + row.count, 0);
  const top = rejections[0]?.count ?? 0;
  const typeMix = stats?.typeMix ?? [];
  const typeTotal = typeMix.reduce((sum, row) => sum + row.count, 0);
  return {
    rejections: rejections.map((row) => ({
      ...row,
      shareBps: ratioBps(row.count, rejectedTotal),
      weight: top ? row.count / top : 0,
    })),
    typeMix: typeMix.map((row) => ({
      ...row,
      shareBps: ratioBps(row.count, typeTotal),
      weight: typeTotal ? row.count / typeTotal : 0,
    })),
    fractionalBps: ratioBps(stats?.amountOrders ?? 0, stats?.ordersToday ?? 0),
  };
}

export function useOrderStream({ status }: { status?: OrderStatus } = {}) {
  const { api, socket } = useAdmin();
  const queryClient = useQueryClient();
  const [paused, setPaused] = useState(false);
  const [missed, setMissed] = useState(0);
  const query: AdminOrdersQuery = { status, limit: ORDER_STREAM_LIMIT };
  const list = useQuery({
    queryKey: adminKeys.orders(query),
    queryFn: async ({ signal }) => (await api.orders(query, { signal })).items,
  });

  useEffect(
    () =>
      socket.onOrder((order) => {
        if (paused) {
          setMissed((count) => count + 1);
          return;
        }
        queryClient.setQueryData<AdminOrder[]>(
          adminKeys.orders({ status, limit: ORDER_STREAM_LIMIT }),
          (items = []) => mergeOrder(items, order, status),
        );
      }),
    [socket, queryClient, paused, status],
  );

  return {
    orders: list.data ?? [],
    isLoading: list.isPending,
    isError: list.isError,
    retry: () => void list.refetch(),
    paused,
    missed,
    togglePause: () => {
      if (paused && missed > 0) {
        void queryClient.invalidateQueries({ queryKey: adminKeys.orderLists });
        void queryClient.invalidateQueries({ queryKey: adminKeys.orderStats });
      }
      setMissed(0);
      setPaused(!paused);
    },
  };
}

export function useAdminOrderStats() {
  const { api } = useAdmin();
  return useQuery({
    queryKey: adminKeys.orderStats,
    queryFn: ({ signal }) => api.orderStats({ signal }),
    refetchInterval: STATS_REFRESH_MS,
    refetchIntervalInBackground: false,
  });
}
