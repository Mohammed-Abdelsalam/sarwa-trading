import { act, renderHook } from '@testing-library/react';

import {
  queryKeys,
  useAverageChange,
  useConnection,
  useIsStale,
  useLiveStatus,
  useLiveSymbols,
  useMarketConnection,
  useMarketStatus,
  useQuote,
  useQuotes,
  useSyncStocksOnChange,
} from '../../src/hooks';
import { createTestClient, createWrapper, makeQuote } from '../utils';

describe('useLiveSymbols', () => {
  it('acquires the symbols and releases them on unmount', () => {
    const client = createTestClient();
    const release = jest.fn();
    jest.mocked(client.market.acquire).mockReturnValue(release);
    const { Wrapper } = createWrapper(client);

    const { unmount } = renderHook(() => useLiveSymbols(['AAPL', 'TSLA']), { wrapper: Wrapper });
    expect(client.market.acquire).toHaveBeenCalledWith(['AAPL', 'TSLA']);

    unmount();
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('swaps the subscription when the symbol list changes', () => {
    const client = createTestClient();
    const releases = [jest.fn(), jest.fn()];
    jest
      .mocked(client.market.acquire)
      .mockReturnValueOnce(releases[0] ?? jest.fn())
      .mockReturnValueOnce(releases[1] ?? jest.fn());
    const { Wrapper } = createWrapper(client);
    const { rerender } = renderHook(({ symbols }) => useLiveSymbols(symbols), {
      wrapper: Wrapper,
      initialProps: { symbols: ['AAPL'] },
    });

    rerender({ symbols: ['NVDA'] });

    expect(releases[0]).toHaveBeenCalledTimes(1);
    expect(client.market.acquire).toHaveBeenLastCalledWith(['NVDA']);
  });

  it('does nothing for an empty list', () => {
    const client = createTestClient();
    const { Wrapper } = createWrapper(client);

    renderHook(() => useLiveSymbols([]), { wrapper: Wrapper });

    expect(client.market.acquire).not.toHaveBeenCalled();
  });
});

describe('live store hooks', () => {
  it('reads the quote, connection and market status, and updates when the store changes', () => {
    const client = createTestClient();
    const { Wrapper } = createWrapper(client);
    const { result } = renderHook(
      () => ({
        quote: useQuote('AAPL'),
        connection: useConnection(),
        market: useMarketStatus(),
        live: useLiveStatus(),
      }),
      { wrapper: Wrapper },
    );
    expect(result.current.quote).toBeUndefined();
    expect(result.current.live).toBe('connecting');

    act(() => {
      client.store.getState().applyQuotes([makeQuote({ price: 300 })]);
      client.store.getState().setConnection({ status: 'open' });
      client.store.getState().setMarketStatus({ state: 'paused', volatility: 1, since: 1 });
    });

    expect(result.current.quote?.price).toBe(300);
    expect(result.current.connection).toEqual({ status: 'open' });
    expect(result.current.market?.state).toBe('paused');
    expect(result.current.live).toBe('paused');
  });
});

describe('useAverageChange', () => {
  it('is null without quotes and the rounded average day change otherwise', () => {
    const client = createTestClient();
    const { Wrapper } = createWrapper(client);
    const { result } = renderHook(() => useAverageChange(['AAPL', 'TSLA']), { wrapper: Wrapper });
    expect(result.current).toBeNull();

    act(() => {
      client.store
        .getState()
        .applyQuotes([
          makeQuote({ symbol: 'AAPL', price: 110, prevClose: 100 }),
          makeQuote({ symbol: 'TSLA', price: 96.667, prevClose: 100 }),
        ]);
    });

    expect(result.current).toBe(3.33);
  });
});

describe('useMarketConnection', () => {
  it('connects in the foreground, disconnects in the background and on unmount', () => {
    const client = createTestClient();
    const { Wrapper } = createWrapper(client);
    const { rerender, unmount } = renderHook((state) => useMarketConnection(state), {
      wrapper: Wrapper,
      initialProps: { foreground: true, online: true },
    });
    expect(client.market.connect).toHaveBeenCalledTimes(1);

    rerender({ foreground: false, online: true });
    expect(client.market.disconnect).toHaveBeenCalledTimes(1);
    expect(client.store.getState().connection.status).not.toBe('offline');

    unmount();
    expect(client.market.disconnect).toHaveBeenCalledTimes(2);
  });

  it('disconnects and reports offline when the network drops', () => {
    const client = createTestClient();
    const { Wrapper } = createWrapper(client);

    renderHook(() => useMarketConnection({ foreground: true, online: false }), {
      wrapper: Wrapper,
    });

    expect(client.market.connect).not.toHaveBeenCalled();
    expect(client.store.getState().connection.status).toBe('offline');
  });
});

describe('useSyncStocksOnChange', () => {
  it('invalidates the stock list and details, but not the charts, when the server reports a change', () => {
    const client = createTestClient();
    const { Wrapper, queryClient } = createWrapper(client);
    queryClient.setQueryData(queryKeys.stocks, []);
    queryClient.setQueryData(queryKeys.stock('AAPL'), {});
    queryClient.setQueryData(queryKeys.candles('AAPL', '1D'), []);
    const invalidated = (queryKey: readonly unknown[]) =>
      queryClient.getQueryState(queryKey)?.isInvalidated;
    renderHook(() => useSyncStocksOnChange(), { wrapper: Wrapper });
    expect(invalidated(queryKeys.stocks)).toBe(false);

    act(() => {
      client.store.getState().setStocksChangedAt(1);
    });

    expect(invalidated(queryKeys.stocks)).toBe(true);
    expect(invalidated(queryKeys.stock('AAPL'))).toBe(true);
    expect(invalidated(queryKeys.candles('AAPL', '1D'))).toBe(false);
  });
});

describe('useIsStale', () => {
  it('turns stale when the connection drops', () => {
    const client = createTestClient();
    const { Wrapper } = createWrapper(client);
    const { result } = renderHook(() => useIsStale(), { wrapper: Wrapper });
    expect(result.current).toBe(false);

    act(() => {
      client.store.getState().setConnection({ status: 'offline' });
    });

    expect(result.current).toBe(true);
  });
});

describe('useQuotes', () => {
  it('subscribes to the symbols and re-renders only when one of their quotes changes', () => {
    const client = createTestClient();
    const { Wrapper } = createWrapper(client);
    let commits = 0;
    const { result } = renderHook(
      () => {
        commits += 1;
        return useQuotes(['AAPL']);
      },
      { wrapper: Wrapper },
    );
    expect(client.market.acquire).toHaveBeenCalledWith(['AAPL']);
    expect(result.current.AAPL).toBeUndefined();

    act(() => {
      client.store.getState().applyQuotes([makeQuote({ symbol: 'AAPL', price: 200, seq: 2 })]);
    });
    const before = commits;
    act(() => {
      client.store.getState().applyQuotes([makeQuote({ symbol: 'TSLA', seq: 3 })]);
    });

    expect(result.current.AAPL?.price).toBe(200);
    expect(commits).toBe(before);
  });
});
