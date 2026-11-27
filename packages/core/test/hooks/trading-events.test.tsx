import { act, renderHook } from '@testing-library/react';

import {
  type AlertsResponse,
  type Order,
  type OrdersResponse,
  type TradingStatus,
} from '@sarwa/contracts';

import {
  type Inbox,
  queryKeys,
  useHalt,
  useIsHalted,
  useTradingEvents,
  useTradingStatus,
} from '../../src/hooks';
import { type TradingEventListener } from '../../src/market-socket';
import {
  makeAlert,
  makeFilledOrder,
  makeNotification,
  makeOrder,
  makeTradingStatus,
} from '../trading-fixtures';
import { createTestClient, createWrapper } from '../utils';

function setup() {
  const client = createTestClient({
    getTradingStatus: () => Promise.resolve(makeTradingStatus()),
  });
  let emit: TradingEventListener = () => undefined;
  jest.mocked(client.market.onTradingEvent).mockImplementation((listener) => {
    emit = listener;
    return jest.fn();
  });
  const { Wrapper, queryClient } = createWrapper(client);
  renderHook(() => useTradingEvents(), { wrapper: Wrapper });
  return { client, queryClient, emit: (event: Parameters<TradingEventListener>[0]) => emit(event) };
}

const orderEvent = (order: Order) => ({ name: 'order.updated', payload: { v: 1, order } }) as const;

describe('useTradingEvents', () => {
  it('upserts an updated order into the matching lists and its detail, and refreshes the books', () => {
    const { queryClient, emit } = setup();
    const empty: OrdersResponse = { items: [], nextCursor: null };
    queryClient.setQueryData(queryKeys.orders({ filter: 'open' }), empty);
    queryClient.setQueryData(queryKeys.orders({ filter: 'filled' }), empty);
    queryClient.setQueryData(queryKeys.portfolio, { stale: false });
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');

    emit(orderEvent(makeOrder()));

    expect(
      queryClient.getQueryData<OrdersResponse>(queryKeys.orders({ filter: 'open' }))?.items,
    ).toHaveLength(1);
    expect(
      queryClient.getQueryData<OrdersResponse>(queryKeys.orders({ filter: 'filled' }))?.items,
    ).toHaveLength(0);
    expect(queryClient.getQueryData(queryKeys.order('ord-1'))).toEqual(makeOrder());
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.portfolio });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.account });
  });

  it('moves a filled order out of the open list and tracks the fill once', () => {
    const { client, queryClient, emit } = setup();
    queryClient.setQueryData(queryKeys.orders({ filter: 'open' }), {
      items: [makeOrder()],
      nextCursor: null,
    });
    queryClient.setQueryData(queryKeys.orders(), { items: [makeOrder()], nextCursor: null });

    emit(orderEvent(makeFilledOrder()));
    emit(orderEvent(makeFilledOrder()));

    expect(
      queryClient.getQueryData<OrdersResponse>(queryKeys.orders({ filter: 'open' }))?.items,
    ).toEqual([]);
    expect(queryClient.getQueryData<OrdersResponse>(queryKeys.orders())?.items).toEqual([
      makeFilledOrder(),
    ]);
    expect(client.analytics.track).toHaveBeenCalledTimes(1);
    expect(client.analytics.track).toHaveBeenCalledWith({
      name: 'order_filled',
      side: 'buy',
      type: 'market',
      slippageBps: 0,
    });
  });

  it('ignores an update older than the cached order', () => {
    const { queryClient, emit } = setup();
    queryClient.setQueryData(queryKeys.order('ord-1'), makeFilledOrder());

    emit(orderEvent(makeOrder({ updatedAt: 1_500 })));

    expect(queryClient.getQueryData<Order>(queryKeys.order('ord-1'))?.status).toBe('filled');
  });

  it('prepends a new notification once and bumps the unread count', () => {
    const { queryClient, emit } = setup();
    queryClient.setQueryData<Inbox>(queryKeys.notifications, {
      pages: [
        { items: [makeNotification({ id: 'old', readAt: 5 })], nextCursor: null, unreadCount: 0 },
      ],
      pageParams: [undefined],
    });
    const event = {
      name: 'notification',
      payload: { v: 1, notification: makeNotification() },
    } as const;

    emit(event);
    emit(event);

    const data = queryClient.getQueryData<Inbox>(queryKeys.notifications)?.pages[0];
    expect(data?.items.map((n) => n.id)).toEqual(['n-1', 'old']);
    expect(data?.unreadCount).toBe(1);
  });

  it('replaces a triggered alert', () => {
    const { queryClient, emit } = setup();
    queryClient.setQueryData<AlertsResponse>(queryKeys.alerts, {
      items: [makeAlert()],
      activeCount: 1,
      limit: 50,
    });

    emit({
      name: 'alert.triggered',
      payload: { v: 1, alert: makeAlert({ armed: false, lastFiredAt: 9 }), lastTicks: 2_600_000 },
    });

    expect(queryClient.getQueryData<AlertsResponse>(queryKeys.alerts)?.items[0]?.armed).toBe(false);
  });

  it('refetches the alerts after a trigger so the active count follows', () => {
    const { queryClient, emit } = setup();
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');

    emit({
      name: 'alert.triggered',
      payload: { v: 1, alert: makeAlert({ armed: false, lastFiredAt: 9 }), lastTicks: 2_600_000 },
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.alerts });
  });

  it('refetches every private cache when the socket reconnects, not on the first connect', () => {
    const { client, queryClient } = setup();
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    const setConnection = (status: 'open' | 'connecting') => {
      act(() => {
        client.store.getState().setConnection({ status });
      });
    };

    setConnection('connecting');
    setConnection('open');
    expect(invalidate).not.toHaveBeenCalled();

    act(() => {
      client.store.getState().setConnection({ status: 'reconnecting', attempt: 1 });
    });
    setConnection('open');

    for (const queryKey of [
      queryKeys.allOrders,
      queryKeys.portfolio,
      queryKeys.account,
      queryKeys.notifications,
      queryKeys.alerts,
      queryKeys.tradingStatus,
    ]) {
      expect(invalidate).toHaveBeenCalledWith({ queryKey });
    }
  });

  it('adds and clears halts and takes a newer trading status', () => {
    const { queryClient, emit } = setup();
    queryClient.setQueryData(queryKeys.tradingStatus, makeTradingStatus({ updatedAt: 10 }));
    const halt = {
      symbol: 'AAPL',
      source: 'admin',
      message: 'News pending',
      since: 1,
      resumesAt: null,
    } as const;
    const halts = () => queryClient.getQueryData<TradingStatus>(queryKeys.tradingStatus)?.halts;

    emit({ name: 'symbol.halted', payload: { v: 1, halt } });
    expect(halts()).toEqual([halt]);

    emit({ name: 'symbol.resumed', payload: { v: 1, symbol: 'AAPL', at: 2 } });
    expect(halts()).toEqual([]);

    emit({
      name: 'trading.status',
      payload: { v: 1, status: makeTradingStatus({ tradingEnabled: false, updatedAt: 5 }) },
    });
    emit({
      name: 'trading.status',
      payload: { v: 1, status: makeTradingStatus({ tradingEnabled: false, updatedAt: 11 }) },
    });
    expect(queryClient.getQueryData<TradingStatus>(queryKeys.tradingStatus)?.updatedAt).toBe(11);
  });

  it('unsubscribes on unmount', () => {
    const client = createTestClient();
    const unsubscribe = jest.fn();
    jest.mocked(client.market.onTradingEvent).mockReturnValue(unsubscribe);
    const { Wrapper } = createWrapper(client);

    const { unmount } = renderHook(() => useTradingEvents(), { wrapper: Wrapper });
    unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});

describe('useHalt', () => {
  it('reports the halt of a symbol from the trading status', () => {
    const client = createTestClient({ getTradingStatus: jest.fn() });
    const { Wrapper, queryClient } = createWrapper(client);
    const halt = {
      symbol: 'TSLA',
      source: 'admin',
      message: 'Pause',
      since: 1,
      resumesAt: 9,
    } as const;
    queryClient.setQueryData(queryKeys.tradingStatus, makeTradingStatus({ halts: [halt] }));

    const { result } = renderHook(
      () => ({
        halt: useHalt('TSLA'),
        halted: useIsHalted('TSLA'),
        other: useIsHalted('AAPL'),
        status: useTradingStatus().data?.tradingEnabled,
      }),
      { wrapper: Wrapper },
    );

    expect(result.current).toEqual({ halt, halted: true, other: false, status: true });
  });
});
