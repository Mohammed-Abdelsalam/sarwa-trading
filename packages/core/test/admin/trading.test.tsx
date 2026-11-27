import { act, renderHook, waitFor } from '@testing-library/react';

import { mergeOrder, useAdminOrderStats, useOrderStream } from '../../src/admin/orders';
import {
  useAdminLive,
  useAdminTrading,
  useCreateHalt,
  useHaltImpact,
  useResumeHalt,
  useUpdateTrading,
} from '../../src/admin/trading';
import { createAdminWrapper, makeAdminOrder, makeAdminTrading } from './fixtures';

describe('trading hooks', () => {
  it('updates the cached controls and syncs live changes', async () => {
    const off = makeAdminTrading({ tradingEnabled: false });
    const { Wrapper, socket } = createAdminWrapper({
      trading: () => Promise.resolve(makeAdminTrading()),
      updateTrading: () => Promise.resolve(off),
    });
    const { result, unmount } = renderHook(
      () => {
        useAdminLive({ enabled: true, foreground: true });
        return { trading: useAdminTrading(), update: useUpdateTrading() };
      },
      { wrapper: Wrapper },
    );
    await waitFor(() => {
      expect(result.current.trading.data?.tradingEnabled).toBe(true);
    });
    expect(socket.connect).toHaveBeenCalled();

    await act(() => result.current.update.mutateAsync({ tradingEnabled: false }));
    await waitFor(() => {
      expect(result.current.trading.data?.tradingEnabled).toBe(false);
    });

    act(() => {
      socket.trading(makeAdminTrading({ sessionMode: 'calendar' }));
    });
    await waitFor(() => {
      expect(result.current.trading.data?.sessionMode).toBe('calendar');
    });

    unmount();
    expect(socket.disconnect).toHaveBeenCalled();
  });

  it('drops the socket in background tabs and refetches orders after reconnecting', () => {
    const { Wrapper, socket, queryClient } = createAdminWrapper({});
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    const { rerender } = renderHook(
      ({ foreground }: { foreground: boolean }) => {
        useAdminLive({ enabled: true, foreground });
      },
      { wrapper: Wrapper, initialProps: { foreground: true } },
    );
    expect(socket.connect).toHaveBeenCalledTimes(1);
    act(() => {
      socket.connected();
    });
    expect(invalidate).not.toHaveBeenCalled();

    rerender({ foreground: false });
    expect(socket.disconnect).toHaveBeenCalled();
    rerender({ foreground: true });
    expect(socket.connect).toHaveBeenCalledTimes(2);
    act(() => {
      socket.connected();
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['admin', 'orders', 'list'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['admin', 'orders', 'stats'] });
  });

  it('loads halt impact only for a chosen symbol and halts/resumes', async () => {
    const haltImpact = jest.fn(() =>
      Promise.resolve({ symbol: 'TSLA', openOrders: 3, holdersAndWatchers: 9 }),
    );
    const createHalt = jest.fn(() =>
      Promise.resolve({
        symbol: 'TSLA',
        source: 'admin' as const,
        message: 'News',
        since: 1,
        resumesAt: null,
      }),
    );
    const resumeHalt = jest.fn(() => Promise.resolve());
    const { Wrapper } = createAdminWrapper({
      haltImpact,
      createHalt,
      resumeHalt,
      trading: () => Promise.resolve(makeAdminTrading()),
    });

    const view = renderHook(() => useHaltImpact(null), { wrapper: Wrapper });
    expect(view.result.current.fetchStatus).toBe('idle');

    const { result } = renderHook(
      () => ({ impact: useHaltImpact('TSLA'), halt: useCreateHalt(), resume: useResumeHalt() }),
      { wrapper: Wrapper },
    );
    await waitFor(() => {
      expect(result.current.impact.data?.openOrders).toBe(3);
    });
    await act(() =>
      result.current.halt.mutateAsync({
        symbol: 'TSLA',
        message: 'News',
        duration: '15m',
        notify: true,
      }),
    );
    await act(() => result.current.resume.mutateAsync('TSLA'));

    expect(resumeHalt).toHaveBeenCalledWith('TSLA');
  });
});

describe('orders', () => {
  it('merges streamed orders newest first within the status filter', () => {
    const a = makeAdminOrder({ id: 'a' });
    const b = makeAdminOrder({ id: 'b', status: 'filled' });

    expect(mergeOrder([a], b).map((o) => o.id)).toEqual(['b', 'a']);
    expect(mergeOrder([a, b], { ...a, status: 'filled' }, 'filled').map((o) => o.id)).toEqual([
      'a',
      'b',
    ]);
    expect(mergeOrder([a], b, undefined, 1)).toEqual([b]);
  });

  it('ignores a late order event older than the cached row', () => {
    const newer = makeAdminOrder({ id: 'a', status: 'filled', updatedAt: 3_000 });
    const late = makeAdminOrder({ id: 'a', status: 'open', updatedAt: 2_000 });

    expect(mergeOrder([newer], late)).toEqual([newer]);
    expect(mergeOrder([late], newer)).toEqual([newer]);
  });

  it('streams orders live and holds them back while paused', async () => {
    const orders = jest.fn(() => Promise.resolve({ items: [makeAdminOrder({ id: 'old' })] }));
    const { Wrapper, socket } = createAdminWrapper({ orders });
    const { result } = renderHook(() => useOrderStream(), { wrapper: Wrapper });
    await waitFor(() => {
      expect(result.current.orders).toHaveLength(1);
    });

    act(() => {
      socket.order(makeAdminOrder({ id: 'new' }));
    });
    await waitFor(() => {
      expect(result.current.orders.map((o) => o.id)).toEqual(['new', 'old']);
    });

    act(() => {
      result.current.togglePause();
    });
    act(() => {
      socket.order(makeAdminOrder({ id: 'held' }));
    });
    expect(result.current.paused).toBe(true);
    expect(result.current.missed).toBe(1);
    expect(result.current.orders).toHaveLength(2);

    act(() => {
      result.current.togglePause();
    });
    expect(result.current.missed).toBe(0);
    await waitFor(() => {
      expect(orders).toHaveBeenCalledTimes(2);
    });
    act(() => {
      result.current.retry();
    });
  });

  it('loads order stats', async () => {
    const { Wrapper } = createAdminWrapper({
      orderStats: () => Promise.resolve({ ordersToday: 4 } as never),
    });
    const { result } = renderHook(() => useAdminOrderStats(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.data).toEqual({ ordersToday: 4 });
    });
  });
});
