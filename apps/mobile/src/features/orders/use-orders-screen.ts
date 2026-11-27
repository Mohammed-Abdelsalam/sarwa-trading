import { useState } from 'react';

import { type OrderFilter } from '@sarwa/contracts';
import { useOrderPages, useOrders } from '@sarwa/core';

import { useNow } from '../../lib/clock';
import { useCopy } from '../../lib/i18n';
import { useStockIndex } from '../../lib/sectors';
import { describeOrder } from './order-copy';

export function useOrdersScreen() {
  const copy = useCopy();
  const [tab, setTab] = useState<OrderFilter>('open');
  const list = useOrderPages({ filter: tab });
  const open = useOrders({ filter: 'open' });
  const { sectorOf } = useStockIndex();
  const now = useNow();

  return {
    tab,
    tabs: [
      { value: 'open', label: copy.t.orders.openTab(copy.f.count(open.data?.items.length ?? 0)) },
      { value: 'filled', label: copy.t.orders.filledTab },
      { value: 'all', label: copy.t.orders.allTab },
    ] satisfies { value: OrderFilter; label: string }[],
    rows: list.items.map((order) => ({
      line: describeOrder(order, copy, now),
      sector: sectorOf(order.symbol),
    })),
    isLoading: list.isLoading,
    isError: list.isError,
    isRefreshing: list.isRefreshing,
    isLoadingMore: list.isLoadingMore,
    actions: {
      setTab,
      refresh: list.refresh,
      loadMore: list.loadMore,
    },
  };
}
