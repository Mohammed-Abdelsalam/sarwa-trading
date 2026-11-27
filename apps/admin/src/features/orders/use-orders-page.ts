import { useState } from 'react';

import { type OrderStatus } from '@sarwa/core';
import {
  orderNotionalCents,
  orderStatsBreakdown,
  useAdminOrderStats,
  useOrderStream,
} from '@sarwa/core/admin';

export type StatusFilter = OrderStatus | 'all';

export function useOrdersPage() {
  const [status, setStatus] = useState<StatusFilter>('all');
  const stream = useOrderStream({ status: status === 'all' ? undefined : status });
  const stats = useAdminOrderStats();
  const data = stats.data;

  return {
    status,
    orders: stream.orders.map((order) => ({ ...order, notionalCents: orderNotionalCents(order) })),
    isLoading: stream.isLoading,
    isError: stream.isError,
    paused: stream.paused,
    missed: stream.missed,
    stats: data,
    statsLoading: stats.isPending,
    ...orderStatsBreakdown(data),
    actions: {
      setStatus,
      togglePause: stream.togglePause,
      retry: () => {
        stream.retry();
        void stats.refetch();
      },
    },
  };
}

export type OrdersPageModel = ReturnType<typeof useOrdersPage>;
