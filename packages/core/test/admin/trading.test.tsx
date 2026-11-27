import { act, renderHook, waitFor } from '@testing-library/react';

import {
  mergeOrder,
  useAdminAccounts,
  useAdminOrderStats,
  useOrderStream,
  useResetAccount,
} from '../../src/admin/orders';
import {
  useAdminLive,
  useAdminTrading,
  useCreateHalt,
  useHaltImpact,
  useResumeHalt,
  useUpdateTrading,
} from '../../src/admin/trading';
import { createAdminWrapper, makeAccount, makeAdminOrder, makeAdminTrading } from './fixtures';

describe('trading hooks', () => {
  it('updates the cached controls and syncs live changes', async () => {
    const off = makeAdminTrading({ tradingEnabled: false });
    const { Wrapper, socket } = createAdminWrapper({
      trading: () => Promise.resolve(makeAdminTrading()),
      updateTrading: () => Promise.resolve(off),
    });
    const { result, unmount } = renderHook(
      () => {
        useAdminLive(true);
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

  it('loads order stats, pages accounts and resets one', async () => {
    const accounts = jest.fn(() =>
      Promise.resolve({ items: [makeAccount()], total: 1, page: 1, pageSize: 25 }),
    );
    const resetAccount = jest.fn(() =>
      Promise.resolve({
        id: 'acc-1',
        handle: 'ACC-00AA11',
        cashCents: 1,
        startingCashCents: 1,
        createdAt: 1,
        resetAt: 2,
      }),
    );
    const { Wrapper } = createAdminWrapper({
      accounts,
      resetAccount,
      orderStats: () => Promise.resolve({ ordersToday: 4 } as never),
    });
    const { result } = renderHook(
      () => ({
        stats: useAdminOrderStats(),
        accounts: useAdminAccounts({ sort: 'equity' }),
        reset: useResetAccount(),
      }),
      { wrapper: Wrapper },
    );
    await waitFor(() => {
      expect(result.current.accounts.data?.total).toBe(1);
    });
    expect(result.current.stats.data).toEqual({ ordersToday: 4 });

    await act(() => result.current.reset.mutateAsync({ id: 'acc-1', confirm: 'RESET ACC-00AA11' }));

    expect(resetAccount).toHaveBeenCalledWith('acc-1', 'RESET ACC-00AA11');
    await waitFor(() => {
      expect(accounts).toHaveBeenCalledTimes(2);
    });
  });
});
