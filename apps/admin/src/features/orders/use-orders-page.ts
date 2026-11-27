import { useSearchParams } from 'next/navigation';

import { type OrderStatus } from '@sarwa/core';
import {
  ORDER_STATUSES,
  orderNotionalCents,
  orderStatsBreakdown,
  useAdminOrderStats,
  useOrderStream,
} from '@sarwa/core/admin';

import { oneOf, setSearchParams } from '../../lib/search-params';

export type StatusFilter = OrderStatus | 'all';

export function useOrdersPage() {
  const status = oneOf<StatusFilter>(useSearchParams().get('status'), ORDER_STATUSES, 'all');
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
      setStatus: (next: StatusFilter) => {
        setSearchParams({ status: next === 'all' ? null : next });
      },
      togglePause: stream.togglePause,
      retry: () => {
        stream.retry();
        void stats.refetch();
      },
    },
  };
}

export type OrdersPageModel = ReturnType<typeof useOrdersPage>;
