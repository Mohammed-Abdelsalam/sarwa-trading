import { act, renderHook, waitFor } from '@testing-library/react';

import { type Order, type OrdersResponse, type PlaceOrderRequest } from '@sarwa/contracts';

import { ApiError } from '../../src/api';
import {
  queryKeys,
  useCancelOrder,
  useModifyOrder,
  useOrder,
  useOrderPages,
  useOrders,
  usePlaceOrder,
} from '../../src/hooks';
import { makeFilledOrder, makeOrder } from '../trading-fixtures';
import { createTestClient, createWrapper } from '../utils';

const REQUEST: PlaceOrderRequest = {
  symbol: 'AAPL',
  side: 'buy',
  type: 'market',
  tif: 'day',
  size: { kind: 'amount', cents: 10_000 },
  quotedTicks: 2_315_000,
};

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const rejected = (code: string, status = 422) =>
  new ApiError({ type: 'about:blank', title: 'Rejected', status, code });

describe('usePlaceOrder', () => {
  it('shows sending until the server answers and adds the order only then', async () => {
    const answer = deferred<Order>();
    const client = createTestClient({ placeOrder: jest.fn(() => answer.promise) });
    const { Wrapper, queryClient } = createWrapper(client);
    queryClient.setQueryData<OrdersResponse>(queryKeys.orders(), { items: [], nextCursor: null });
    const { result } = renderHook(() => usePlaceOrder(), { wrapper: Wrapper });

    act(() => {
      result.current.submit(REQUEST);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('sending');
    });
    expect(queryClient.getQueryData<OrdersResponse>(queryKeys.orders())?.items).toEqual([]);

    await act(async () => {
      answer.resolve(makeOrder());
      await answer.promise;
    });

    await waitFor(() => {
      expect(result.current.status).toBe('done');
    });
    expect(result.current.order).toEqual(makeOrder());
    expect(queryClient.getQueryData<OrdersResponse>(queryKeys.orders())?.items).toEqual([
      makeOrder(),
    ]);
    expect(client.analytics.track).toHaveBeenCalledWith({
      name: 'order_submitted',
      side: 'buy',
      type: 'market',
      sizeKind: 'amount',
    });
  });

  it('reuses one idempotency key for retries of an attempt and makes a new one per attempt', async () => {
    const placeOrder = jest
      .fn<Promise<Order>, [PlaceOrderRequest, string]>()
      .mockRejectedValueOnce(rejected('CONFLICT', 409))
      .mockResolvedValue(makeOrder());
    const client = createTestClient({ placeOrder });
    const { Wrapper } = createWrapper(client);
    const { result } = renderHook(() => usePlaceOrder(), { wrapper: Wrapper });

    act(() => {
      result.current.submit(REQUEST);
    });
    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });
    act(() => {
      result.current.retry();
    });
    await waitFor(() => {
      expect(result.current.status).toBe('done');
    });
    act(() => {
      result.current.reset();
      result.current.submit(REQUEST);
    });
    await waitFor(() => {
      expect(placeOrder).toHaveBeenCalledTimes(3);
    });

    const keys = placeOrder.mock.calls.map(([, key]) => key);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[0]);
  });

  it('ignores a second submit while the first is still sending', async () => {
    const answer = deferred<Order>();
    const placeOrder = jest.fn(() => answer.promise);
    const { Wrapper } = createWrapper(createTestClient({ placeOrder }));
    const { result } = renderHook(() => usePlaceOrder(), { wrapper: Wrapper });

    act(() => {
      result.current.submit(REQUEST);
    });
    await waitFor(() => {
      expect(result.current.status).toBe('sending');
    });
    act(() => {
      result.current.submit(REQUEST);
    });

    expect(placeOrder).toHaveBeenCalledTimes(1);
  });

  it('tracks a rejected order by its rejection code', async () => {
    const order = makeOrder({
      status: 'rejected',
      rejection: {
        code: 'INSUFFICIENT_FUNDS',
        field: 'size',
        requiredCents: 10_000,
        availableCents: 5,
      },
    });
    const client = createTestClient({ placeOrder: () => Promise.resolve(order) });
    const { Wrapper } = createWrapper(client);
    const { result } = renderHook(() => usePlaceOrder(), { wrapper: Wrapper });

    act(() => {
      result.current.submit(REQUEST);
    });

    await waitFor(() => {
      expect(client.analytics.track).toHaveBeenCalledWith({
        name: 'order_rejected',
        code: 'INSUFFICIENT_FUNDS',
      });
    });
  });

  // Business rejections only arrive as a stored rejected order; a 4xx is a request error.
  it('never counts a 4xx problem as a business rejection', async () => {
    const client = createTestClient({
      placeOrder: () => Promise.reject(rejected('MARKET_CLOSED')),
    });
    const { Wrapper } = createWrapper(client);
    const { result } = renderHook(() => usePlaceOrder(), { wrapper: Wrapper });

    act(() => {
      result.current.submit(REQUEST);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });
    expect(client.analytics.track).not.toHaveBeenCalledWith(
      expect.objectContaining({ name: 'order_rejected' }),
    );
  });

  it('tracks a market order that fills on placement', async () => {
    const client = createTestClient({ placeOrder: () => Promise.resolve(makeFilledOrder()) });
    const { Wrapper } = createWrapper(client);
    const { result } = renderHook(() => usePlaceOrder(), { wrapper: Wrapper });

    act(() => {
      result.current.submit(REQUEST);
    });

    await waitFor(() => {
      expect(client.analytics.track).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'order_filled' }),
      );
    });
  });
});

describe('useCancelOrder', () => {
  it('reports a cancel that lost the race to a fill and stores the filled order', async () => {
    const client = createTestClient({
      cancelOrder: () => Promise.resolve({ outcome: 'already_filled', order: makeFilledOrder() }),
    });
    const { Wrapper, queryClient } = createWrapper(client);
    queryClient.setQueryData(queryKeys.order('ord-1'), makeOrder());
    const { result } = renderHook(() => useCancelOrder(), { wrapper: Wrapper });

    act(() => {
      result.current.mutate('ord-1');
    });

    await waitFor(() => {
      expect(result.current.data?.outcome).toBe('already_filled');
    });
    expect(queryClient.getQueryData<Order>(queryKeys.order('ord-1'))?.status).toBe('filled');
    expect(client.analytics.track).toHaveBeenCalledWith({
      name: 'order_canceled',
      outcome: 'already_filled',
    });
  });
});

describe('useModifyOrder, useOrders and useOrder', () => {
  it('loads lists and details and stores a modified order', async () => {
    const modified = makeOrder({ type: 'limit', limitTicks: 2_000_000, updatedAt: 3_000 });
    const listOrders = jest.fn(() => Promise.resolve({ items: [makeOrder()], nextCursor: null }));
    const client = createTestClient({
      listOrders,
      getOrder: () => Promise.resolve(makeOrder()),
      modifyOrder: () => Promise.resolve(modified),
    });
    const { Wrapper, queryClient } = createWrapper(client);
    const { result } = renderHook(
      () => ({
        list: useOrders({ filter: 'open' }),
        detail: useOrder('ord-1'),
        modify: useModifyOrder(),
      }),
      { wrapper: Wrapper },
    );
    await waitFor(() => {
      expect(result.current.list.data?.items).toHaveLength(1);
    });
    await waitFor(() => {
      expect(result.current.detail.data?.id).toBe('ord-1');
    });

    act(() => {
      result.current.modify.mutate({ id: 'ord-1', patch: { limitTicks: 2_000_000 } });
    });

    await waitFor(() => {
      expect(queryClient.getQueryData<Order>(queryKeys.order('ord-1'))?.limitTicks).toBe(2_000_000);
    });
    expect(listOrders).toHaveBeenCalledWith(
      { filter: 'open' },
      { signal: expect.any(AbortSignal) },
    );
  });
});

describe('useOrderPages', () => {
  it('loads older pages by cursor and keeps every page current', async () => {
    const listOrders = jest.fn((query?: { cursor?: string }) =>
      Promise.resolve<OrdersResponse>(
        query?.cursor === 'ord-1'
          ? { items: [makeOrder({ id: 'ord-0', createdAt: 1 })], nextCursor: null }
          : { items: [makeOrder({ id: 'ord-1', createdAt: 2 })], nextCursor: 'ord-1' },
      ),
    );
    const client = createTestClient({
      listOrders,
      cancelOrder: (id: string) =>
        Promise.resolve({
          outcome: 'canceled' as const,
          order: makeOrder({ id, status: 'canceled', updatedAt: 5_000 }),
        }),
    });
    const { Wrapper } = createWrapper(client);
    const { result } = renderHook(
      () => ({ pages: useOrderPages({ filter: 'open' }), cancel: useCancelOrder() }),
      { wrapper: Wrapper },
    );
    await waitFor(() => {
      expect(result.current.pages.hasMore).toBe(true);
    });

    act(() => {
      result.current.pages.loadMore();
    });
    await waitFor(() => {
      expect(result.current.pages.items.map((order) => order.id)).toEqual(['ord-1', 'ord-0']);
    });
    expect(result.current.pages.hasMore).toBe(false);
    expect(listOrders).toHaveBeenLastCalledWith(
      { filter: 'open', cursor: 'ord-1' },
      { signal: expect.any(AbortSignal) },
    );

    act(() => {
      result.current.cancel.mutate('ord-0');
    });

    await waitFor(() => {
      expect(result.current.pages.items.map((order) => order.id)).toEqual(['ord-1']);
    });
  });

  it('adds a new order to the top of the first page only', async () => {
    const client = createTestClient({
      listOrders: (query?: { cursor?: string }) =>
        Promise.resolve<OrdersResponse>(
          query?.cursor
            ? { items: [makeOrder({ id: 'old' })], nextCursor: null }
            : { items: [makeOrder({ id: 'mid' })], nextCursor: 'mid' },
        ),
      placeOrder: () => Promise.resolve(makeOrder({ id: 'new' })),
    });
    const { Wrapper } = createWrapper(client);
    const { result } = renderHook(() => ({ pages: useOrderPages(), place: usePlaceOrder() }), {
      wrapper: Wrapper,
    });
    await waitFor(() => {
      expect(result.current.pages.hasMore).toBe(true);
    });
    act(() => {
      result.current.pages.loadMore();
    });
    await waitFor(() => {
      expect(result.current.pages.items).toHaveLength(2);
    });

    act(() => {
      result.current.place.submit(REQUEST);
    });

    await waitFor(() => {
      expect(result.current.pages.items.map((order) => order.id)).toEqual(['new', 'mid', 'old']);
    });
  });
});
