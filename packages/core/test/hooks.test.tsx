import { act, renderHook, waitFor } from '@testing-library/react';

import { type AppConfig, type Candle, PERIODS } from '@sarwa/contracts';

import {
  queryKeys,
  useAppConfig,
  useAppNotices,
  useAverageChange,
  useChartSeries,
  useConnection,
  useEnabledPeriods,
  useLiveStatus,
  useLiveSymbols,
  useMarketConnection,
  useMarketList,
  useMarketStatus,
  useQuote,
  useRefreshAppConfig,
  useStockDetail,
  useStocks,
  useSyncStocksOnChange,
  useToggleWatchlist,
  useWatchedSymbols,
  useWatchlist,
  useWatchlistStocks,
} from '../src/hooks';
import { SORTS } from '../src/markets';
import { createTestClient, createWrapper, makeProblem, makeQuote, makeStock } from './utils';

const config = (overrides: Partial<AppConfig> = {}): AppConfig => ({
  maintenanceMode: false,
  banner: null,
  enabledPeriods: [...PERIODS],
  updatedAt: 1,
  ...overrides,
});

const candle = (t: number, c: number): Candle => ({ t, o: c, h: c, l: c, c, v: 1 });

describe('useStocks', () => {
  it('seeds the live store with the REST snapshot', async () => {
    const stock = makeStock('NVDA');
    const client = createTestClient({ listStocks: () => Promise.resolve({ items: [stock] }) });
    const { Wrapper } = createWrapper(client);

    const { result } = renderHook(() => useStocks(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(client.store.getState().quotes.NVDA).toEqual(stock.quote);
  });
});

describe('useWatchlist', () => {
  it('passes the query abort signal to the API so leaving a screen cancels the request', async () => {
    const getWatchlist = jest.fn(() => Promise.resolve({ symbols: [] }));
    const { Wrapper } = createWrapper(createTestClient({ getWatchlist }));

    const { result } = renderHook(() => useWatchlist(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(getWatchlist).toHaveBeenCalledWith({ signal: expect.any(AbortSignal) });
  });
});

describe('useWatchedSymbols', () => {
  it('exposes the watchlist as a set for O(1) star lookups', async () => {
    const client = createTestClient({ getWatchlist: () => Promise.resolve({ symbols: ['AAPL'] }) });
    const { Wrapper } = createWrapper(client);

    const { result } = renderHook(() => useWatchedSymbols(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.has('AAPL')).toBe(true);
    });
    expect(result.current.has('TSLA')).toBe(false);
  });
});

describe('useSyncStocksOnChange', () => {
  it('invalidates the stock list and details when the server reports a change', () => {
    const client = createTestClient();
    const { Wrapper, queryClient } = createWrapper(client);
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    renderHook(() => useSyncStocksOnChange(), { wrapper: Wrapper });
    expect(invalidate).not.toHaveBeenCalled();

    act(() => {
      client.store.getState().setStocksChangedAt(1);
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.stocks });
  });
});

describe('useToggleWatchlist', () => {
  it('adds a symbol optimistically before the server answers', async () => {
    const client = createTestClient({ addToWatchlist: () => new Promise<void>(() => undefined) });
    const { Wrapper, queryClient } = createWrapper(client);
    queryClient.setQueryData(queryKeys.watchlist, []);

    const { result } = renderHook(() => useToggleWatchlist(), { wrapper: Wrapper });
    act(() => {
      result.current.mutate({ symbol: 'AAPL', watched: false });
    });

    await waitFor(() => {
      expect(queryClient.getQueryData(queryKeys.watchlist)).toEqual(['AAPL']);
    });
  });

  it('removes a symbol optimistically before the server answers', async () => {
    const client = createTestClient({
      removeFromWatchlist: () => new Promise<void>(() => undefined),
    });
    const { Wrapper, queryClient } = createWrapper(client);
    queryClient.setQueryData(queryKeys.watchlist, ['AAPL', 'TSLA']);

    const { result } = renderHook(() => useToggleWatchlist(), { wrapper: Wrapper });
    act(() => {
      result.current.mutate({ symbol: 'AAPL', watched: true });
    });

    await waitFor(() => {
      expect(queryClient.getQueryData(queryKeys.watchlist)).toEqual(['TSLA']);
    });
  });

  it('rolls back to the previous list when the request fails', async () => {
    const client = createTestClient({
      removeFromWatchlist: () => Promise.reject(makeProblem(503)),
    });
    const { Wrapper, queryClient } = createWrapper(client);
    queryClient.setQueryData(queryKeys.watchlist, ['AAPL', 'TSLA']);

    const { result } = renderHook(() => useToggleWatchlist(), { wrapper: Wrapper });
    act(() => {
      result.current.mutate({ symbol: 'AAPL', watched: true });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(queryClient.getQueryData(queryKeys.watchlist)).toEqual(['AAPL', 'TSLA']);
  });

  it('refetches once, after the last of two overlapping toggles settles', async () => {
    const settle: (() => void)[] = [];
    const client = createTestClient({
      addToWatchlist: () => new Promise<void>((resolve) => settle.push(resolve)),
    });
    const { Wrapper, queryClient } = createWrapper(client);
    queryClient.setQueryData(queryKeys.watchlist, []);
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useToggleWatchlist(), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({ symbol: 'AAPL', watched: false });
      result.current.mutate({ symbol: 'NVDA', watched: false });
    });
    await waitFor(() => {
      expect(settle).toHaveLength(2);
    });
    await act(async () => {
      settle[0]?.();
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(queryClient.isMutating()).toBe(1);
    });

    expect(invalidate).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(queryKeys.watchlist)).toEqual(['AAPL', 'NVDA']);

    await act(async () => {
      settle[1]?.();
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledTimes(1);
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.watchlist });
  });
});

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
    expect(result.current.live).toBe('reconnecting');

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

describe('useAppConfig', () => {
  it('returns the REST config when nothing came over the socket', async () => {
    const rest = config({ updatedAt: 5 });
    const { Wrapper } = createWrapper(
      createTestClient({ getAppConfig: () => Promise.resolve(rest) }),
    );

    const { result } = renderHook(() => useAppConfig(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current).toEqual(rest);
    });
  });

  it('returns the live config while REST has not answered', () => {
    const client = createTestClient({ getAppConfig: () => new Promise(() => undefined) });
    const live = config({ maintenanceMode: true });
    client.store.getState().setAppConfig(live);
    const { Wrapper } = createWrapper(client);

    const { result } = renderHook(() => useAppConfig(), { wrapper: Wrapper });

    expect(result.current).toEqual(live);
  });

  it('prefers whichever config is newer', async () => {
    const rest = config({ updatedAt: 10, maintenanceMode: false });
    const client = createTestClient({ getAppConfig: () => Promise.resolve(rest) });
    client.store.getState().setAppConfig(config({ updatedAt: 5, maintenanceMode: true }));
    const { Wrapper } = createWrapper(client);
    const { result } = renderHook(() => useAppConfig(), { wrapper: Wrapper });
    await waitFor(() => {
      expect(result.current).toEqual(rest);
    });

    const newer = config({ updatedAt: 20, maintenanceMode: true });
    act(() => {
      client.store.getState().setAppConfig(newer);
    });

    expect(result.current).toEqual(newer);
  });
});

describe('useEnabledPeriods', () => {
  it('falls back to every period and follows the admin config once loaded', async () => {
    const { Wrapper } = createWrapper(
      createTestClient({
        getAppConfig: () => Promise.resolve(config({ enabledPeriods: ['1D', '1W'] })),
      }),
    );

    const { result } = renderHook(() => useEnabledPeriods(), { wrapper: Wrapper });
    expect(result.current).toEqual(PERIODS);

    await waitFor(() => {
      expect(result.current).toEqual(['1D', '1W']);
    });
  });
});

describe('useAppNotices', () => {
  it('hides a dismissed banner and shows the next new message again', async () => {
    const client = createTestClient({
      getAppConfig: () =>
        Promise.resolve(config({ banner: { message: 'Early close', tone: 'info' } })),
    });
    client.store.getState().setConnection({ status: 'open' });
    const { Wrapper } = createWrapper(client);
    const { result } = renderHook(() => useAppNotices(), { wrapper: Wrapper });
    await waitFor(() => {
      expect(result.current.notices).toHaveLength(1);
    });

    act(() => {
      const [remote] = result.current.notices;
      if (remote) result.current.dismiss(remote);
    });
    expect(result.current.notices).toEqual([]);

    act(() => {
      client.store
        .getState()
        .setAppConfig(config({ updatedAt: 2, banner: { message: 'Holiday', tone: 'warning' } }));
    });
    expect(result.current.notices.map((n) => n.message)).toEqual(['Holiday']);
  });
});

describe('useRefreshAppConfig', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('invalidates the config on the interval and stops on unmount', () => {
    jest.useFakeTimers();
    const { Wrapper, queryClient } = createWrapper(createTestClient());
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    const { unmount } = renderHook(() => useRefreshAppConfig({ every: 30_000 }), {
      wrapper: Wrapper,
    });

    act(() => {
      jest.advanceTimersByTime(30_000);
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.appConfig });

    unmount();
    act(() => {
      jest.advanceTimersByTime(60_000);
    });
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it('refreshes on demand without an interval', () => {
    const { Wrapper, queryClient } = createWrapper(createTestClient());
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useRefreshAppConfig(), { wrapper: Wrapper });

    result.current();

    expect(invalidate).toHaveBeenCalledTimes(1);
  });
});

describe('useChartSeries', () => {
  it('moves the last candle to the live price and measures 1D against the previous close', async () => {
    const client = createTestClient({
      getCandles: () =>
        Promise.resolve({
          symbol: 'AAPL',
          period: '1D',
          candles: [candle(1, 100), candle(2, 101), candle(3, 102)],
        }),
    });
    client.store.getState().applyQuotes([makeQuote({ price: 98, prevClose: 99 })]);
    const { Wrapper } = createWrapper(client);

    const { result } = renderHook(() => useChartSeries('AAPL', '1D'), { wrapper: Wrapper });
    expect(result.current.state).toBe('loading');

    await waitFor(() => {
      expect(result.current.state).toBe('ready');
    });
    expect(result.current.candles.at(-1)?.c).toBe(98);
    expect(result.current.baseline).toBe(99);
    expect(result.current.showBaseline).toBe(true);
    expect(result.current.rising).toBe(false);
    expect(result.current.axisCandles).toHaveLength(5);
  });

  it('reports an error and refetches on retry', async () => {
    const getCandles = jest.fn(() => Promise.reject(makeProblem(503)));
    const { Wrapper } = createWrapper(createTestClient({ getCandles }));

    const { result } = renderHook(() => useChartSeries('AAPL', '1M'), { wrapper: Wrapper });
    await waitFor(() => {
      expect(result.current.state).toBe('error');
    });

    act(() => {
      result.current.retry();
    });

    await waitFor(() => {
      expect(getCandles).toHaveBeenCalledTimes(2);
    });
    expect(result.current.showBaseline).toBe(false);
  });
});

describe('useStockDetail', () => {
  const detail = {
    stock: { symbol: 'AAPL', name: 'Apple', sector: 'tech', exchange: 'NASDAQ', currency: 'USD' },
    quote: makeQuote({ price: 200 }),
    stats: { marketCap: 1, peRatio: 30, week52High: 250, week52Low: 150, avgVolume: 1 },
  } as const;

  it('streams the symbol and prefers the live quote over the snapshot', async () => {
    const client = createTestClient({ getStock: () => Promise.resolve(detail) });
    const { Wrapper } = createWrapper(client);
    const { result } = renderHook(() => useStockDetail('AAPL'), { wrapper: Wrapper });
    await waitFor(() => {
      expect(result.current.stats).not.toBeNull();
    });
    expect(client.market.acquire).toHaveBeenCalledWith(['AAPL']);

    act(() => {
      client.store.getState().applyQuotes([makeQuote({ price: 205, ts: 9_999 })]);
    });

    expect(result.current.quote?.price).toBe(205);
    expect(result.current.stock?.name).toBe('Apple');
  });

  it('tells a missing stock apart from a failed request', async () => {
    const { Wrapper } = createWrapper(
      createTestClient({ getStock: () => Promise.reject(makeProblem(404)) }),
    );

    const { result } = renderHook(() => useStockDetail('ZZZZ'), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.notFound).toBe(true);
    });
    expect(result.current.isError).toBe(false);
  });

  it('reports other failures as errors that can be retried', async () => {
    const getStock = jest.fn(() => Promise.reject(makeProblem(503)));
    const { Wrapper } = createWrapper(createTestClient({ getStock }));
    const { result } = renderHook(() => useStockDetail('AAPL'), { wrapper: Wrapper });
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    act(() => {
      result.current.retry();
    });

    await waitFor(() => {
      expect(getStock).toHaveBeenCalledTimes(2);
    });
  });
});

describe('useWatchlistStocks', () => {
  it('lists the watched stocks with their average change and streams them', async () => {
    const client = createTestClient({
      getWatchlist: () => Promise.resolve({ symbols: ['AAPL'] }),
      listStocks: () =>
        Promise.resolve({
          items: [
            makeStock('AAPL', {}, { price: 110, prevClose: 100 }),
            makeStock('TSLA', {}, { symbol: 'TSLA' }),
          ],
        }),
    });
    const { Wrapper } = createWrapper(client);

    const { result } = renderHook(() => useWatchlistStocks(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.rows.map((s) => s.symbol)).toEqual(['AAPL']);
    });
    expect(result.current.symbols).toEqual(['AAPL']);
    expect(result.current.average).toBe(10);
    expect(client.market.acquire).toHaveBeenCalledWith(['AAPL']);
  });

  it('is an error only without data, and retry refetches just the failed query', async () => {
    const getWatchlist = jest.fn(() => Promise.reject(makeProblem(503)));
    const listStocks = jest.fn(() => Promise.resolve({ items: [makeStock('AAPL')] }));
    const { Wrapper } = createWrapper(createTestClient({ getWatchlist, listStocks }));
    const { result } = renderHook(() => useWatchlistStocks(), { wrapper: Wrapper });
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    act(() => {
      result.current.retry();
    });

    await waitFor(() => {
      expect(getWatchlist).toHaveBeenCalledTimes(2);
    });
    expect(listStocks).toHaveBeenCalledTimes(1);
  });
});

describe('useMarketList', () => {
  it('filters and sorts the snapshot', async () => {
    const { Wrapper } = createWrapper(
      createTestClient({
        listStocks: () =>
          Promise.resolve({
            items: [makeStock('JPM', { sector: 'fin' }), makeStock('AAPL', { sector: 'tech' })],
          }),
      }),
    );

    const { result } = renderHook(
      () => useMarketList({ query: '', sector: 'fin', sort: SORTS[0] }),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(result.current.rows.map((s) => s.symbol)).toEqual(['JPM']);
    });
    expect(result.current.isLoading).toBe(false);
  });

  it('is an error without cached data and refetches on refresh', async () => {
    const listStocks = jest.fn(() => Promise.reject(makeProblem(503)));
    const { Wrapper } = createWrapper(createTestClient({ listStocks }));
    const { result } = renderHook(
      () => useMarketList({ query: '', sector: 'all', sort: SORTS[0] }),
      { wrapper: Wrapper },
    );
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    act(() => {
      result.current.refresh();
    });

    await waitFor(() => {
      expect(listStocks).toHaveBeenCalledTimes(2);
    });
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
