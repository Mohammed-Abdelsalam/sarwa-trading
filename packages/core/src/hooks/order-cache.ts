import { type InfiniteData, type QueryClient } from '@tanstack/react-query';

import { type Order, type OrdersResponse } from '@sarwa/contracts';
import { isTerminal } from '@sarwa/domain';

import { type AnalyticsProvider } from '../analytics';
import { orderFill } from '../trading';
import { type MeKeys, type OrderListQuery } from './keys';

function belongsTo(order: Order, query: OrderListQuery): boolean {
  if (query.symbol && query.symbol !== order.symbol) return false;
  if (query.filter === 'open') return !isTerminal(order.status);
  if (query.filter === 'filled') return order.status === 'filled';
  return true;
}

export function upsertOrderInList(
  list: OrdersResponse,
  order: Order,
  query: OrderListQuery,
): OrdersResponse {
  const exists = list.items.some((item) => item.id === order.id);
  if (!belongsTo(order, query)) {
    return exists ? { ...list, items: list.items.filter((item) => item.id !== order.id) } : list;
  }
  return {
    ...list,
    items: exists
      ? list.items.map((item) => (item.id === order.id ? order : item))
      : [order, ...list.items],
  };
}

type OrderPages = InfiniteData<OrdersResponse, string | undefined>;

const hasOrder = (page: OrdersResponse, id: string) => page.items.some((item) => item.id === id);

// A known order is updated in the page that holds it; a new one goes to the top of the first page.
export function upsertOrderInPages(
  data: OrderPages,
  order: Order,
  query: OrderListQuery,
): OrderPages {
  const exists = data.pages.some((page) => hasOrder(page, order.id));
  return {
    ...data,
    pages: data.pages.map((page, index) =>
      (exists ? hasOrder(page, order.id) : index === 0)
        ? upsertOrderInList(page, order, query)
        : page,
    ),
  };
}

function cachedOrder(queryClient: QueryClient, keys: MeKeys, id: string): Order | undefined {
  const detail = queryClient.getQueryData<Order>(keys.order(id));
  if (detail) return detail;
  const lists = [
    ...queryClient
      .getQueriesData<OrdersResponse>({ queryKey: keys.orderLists })
      .map(([, list]) => list),
    ...queryClient
      .getQueriesData<OrderPages>({ queryKey: keys.orderPageLists })
      .flatMap(([, data]) => data?.pages ?? []),
  ];
  for (const list of lists) {
    const found = list?.items.find((item) => item.id === id);
    if (found) return found;
  }
  return undefined;
}

// The one path every order change takes (REST answer or socket event), so lists, detail, books and
// the order_filled event agree whichever arrives first.
export function applyOrderUpdate(
  queryClient: QueryClient,
  keys: MeKeys,
  order: Order,
  track: AnalyticsProvider['track'],
): void {
  const previous = cachedOrder(queryClient, keys, order.id);
  if (previous && previous.updatedAt > order.updatedAt) return;

  queryClient.setQueryData(keys.order(order.id), order);
  for (const query of queryClient.getQueryCache().findAll({ queryKey: keys.orderLists })) {
    const filter = (query.queryKey[keys.orderLists.length] ?? {}) as OrderListQuery;
    queryClient.setQueryData<OrdersResponse>(query.queryKey, (list) =>
      list ? upsertOrderInList(list, order, filter) : list,
    );
  }
  for (const query of queryClient.getQueryCache().findAll({ queryKey: keys.orderPageLists })) {
    const filter = (query.queryKey[keys.orderPageLists.length] ?? {}) as OrderListQuery;
    queryClient.setQueryData<OrderPages>(query.queryKey, (data) =>
      data ? upsertOrderInPages(data, order, filter) : data,
    );
  }
  if (order.status === 'filled' && previous?.status !== 'filled') {
    track({
      name: 'order_filled',
      side: order.side,
      type: order.type,
      slippageBps: orderFill(order).slippageBps ?? 0,
    });
  }
  void queryClient.invalidateQueries({ queryKey: keys.portfolio });
  void queryClient.invalidateQueries({ queryKey: keys.account });
}
