import {
  type MutationStatus,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useRef } from 'react';

import {
  type ModifyOrderRequest,
  type Order,
  type OrdersResponse,
  type PlaceOrderRequest,
} from '@sarwa/contracts';

import { shouldRetry } from '../api';
import { useSarwa } from '../provider';
import { type TicketForm } from '../ticket';
import { useRequireAuth } from './gate';
import { type OrderListQuery } from './keys';
import { applyOrderUpdate } from './order-cache';
import { usePrivateScope } from './session';

export function useOrders(query: OrderListQuery = {}): UseQueryResult<OrdersResponse> {
  const { api } = useSarwa();
  const { keys, enabled } = usePrivateScope();
  return useQuery({
    queryKey: keys.orders(query),
    queryFn: ({ signal }) => api.listOrders(query, { signal }),
    staleTime: 15_000,
    enabled,
  });
}

// Every page of a list, newest first; the Orders screens load older pages on demand.
export function useOrderPages(query: OrderListQuery = {}) {
  const { api } = useSarwa();
  const { keys, enabled } = usePrivateScope();
  const result = useInfiniteQuery({
    queryKey: keys.orderPages(query),
    queryFn: ({ signal, pageParam }) => api.listOrders({ ...query, cursor: pageParam }, { signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    staleTime: 15_000,
    enabled,
  });
  return {
    items: result.data?.pages.flatMap((page) => page.items) ?? [],
    isLoading: enabled && result.isPending,
    isError: result.isError && !result.data,
    isRefreshing: result.isRefetching && !result.isFetchingNextPage,
    hasMore: result.hasNextPage,
    isLoadingMore: result.isFetchingNextPage,
    loadMore: () => {
      if (result.hasNextPage && !result.isFetchingNextPage) void result.fetchNextPage();
    },
    refresh: () => void result.refetch(),
  };
}

export function useOrder(id: string): UseQueryResult<Order> {
  const { api } = useSarwa();
  const { keys, enabled } = usePrivateScope();
  return useQuery({
    queryKey: keys.order(id),
    queryFn: ({ signal }) => api.getOrder(id, { signal }),
    staleTime: 15_000,
    enabled,
  });
}

export type SubmitStatus = 'idle' | 'sending' | 'done' | 'error';

const SUBMIT_STATUS: Record<MutationStatus, SubmitStatus> = {
  idle: 'idle',
  pending: 'sending',
  success: 'done',
  error: 'error',
};

interface Attempt {
  request: PlaceOrderRequest;
  key: string;
}

// The same order apart from the quoted price, which refreshes while the review waits.
const sameOrder = (a: PlaceOrderRequest, b: PlaceOrderRequest) =>
  JSON.stringify({ ...a, quotedTicks: 0 }) === JSON.stringify({ ...b, quotedTicks: 0 });

// Never optimistic: the order exists only once the server answers. Every send of one attempt
// (automatic retries, retry() and placing the unchanged order again after an error) carries the
// same Idempotency-Key, so an order the server already took can never fill twice.
export function usePlaceOrder() {
  const { api, analytics, newId } = useSarwa();
  const queryClient = useQueryClient();
  const { keys } = usePrivateScope();
  const { run } = useRequireAuth();
  const attempt = useRef<Attempt | null>(null);
  const inFlight = useRef(false);

  const mutation = useMutation({
    mutationFn: ({ request, key }: Attempt) => api.placeOrder(request, key),
    onSettled: () => {
      inFlight.current = false;
    },
    retry: shouldRetry,
    // Business rejections come back as a stored rejected order (201); a 4xx is a request error.
    onSuccess: (order) => {
      applyOrderUpdate(queryClient, keys, order, analytics.track);
      if (order.rejection) analytics.track({ name: 'order_rejected', code: order.rejection.code });
    },
  });

  const send = (next: Attempt) => {
    inFlight.current = true;
    mutation.mutate(next);
  };

  return {
    status: SUBMIT_STATUS[mutation.status],
    order: mutation.data ?? null,
    error: mutation.error,
    // A guest gets the sign-in gate instead; the ticket reopens prefilled with `form`, never sent.
    submit: (request: PlaceOrderRequest, form?: TicketForm) => {
      run({ kind: 'order', symbol: request.symbol, side: request.side, form }, () => {
        if (inFlight.current) return;
        const previous = attempt.current;
        if (previous && mutation.status === 'error' && sameOrder(previous.request, request)) {
          send(previous);
          return;
        }
        attempt.current = { request, key: newId() };
        analytics.track({
          name: 'order_submitted',
          side: request.side,
          type: request.type,
          sizeKind: request.size.kind,
        });
        send(attempt.current);
      });
    },
    retry: () => {
      if (attempt.current && !inFlight.current) send(attempt.current);
    },
    reset: () => {
      attempt.current = null;
      mutation.reset();
    },
  };
}

export function useCancelOrder() {
  const { api, analytics } = useSarwa();
  const queryClient = useQueryClient();
  const { keys } = usePrivateScope();
  return useMutation({
    mutationFn: (id: string) => api.cancelOrder(id),
    onSuccess: ({ outcome, order }) => {
      applyOrderUpdate(queryClient, keys, order, analytics.track);
      analytics.track({ name: 'order_canceled', outcome });
    },
  });
}

export function useModifyOrder() {
  const { api, analytics } = useSarwa();
  const queryClient = useQueryClient();
  const { keys } = usePrivateScope();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ModifyOrderRequest }) =>
      api.modifyOrder(id, patch),
    onSuccess: (order) => {
      applyOrderUpdate(queryClient, keys, order, analytics.track);
    },
  });
}
