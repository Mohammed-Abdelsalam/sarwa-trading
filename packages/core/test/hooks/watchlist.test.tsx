import { act, renderHook, waitFor } from '@testing-library/react';

import {
  queryKeys,
  useIsWatched,
  useToggleWatchlist,
  useUndoableRemove,
  useWatchedSymbols,
  useWatchlist,
  useWatchlistStocks,
  useWatchToggle,
} from '../../src/hooks';
import { SORTS } from '../../src/markets';
import { createTestClient, createWrapper, makeProblem, makeStock } from '../utils';

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

  it('refetches right away when a toggle fails with nothing cached to roll back to', async () => {
    const client = createTestClient({
      addToWatchlist: jest
        .fn()
        .mockRejectedValueOnce(makeProblem(503))
        .mockReturnValue(new Promise<void>(() => undefined)),
    });
    const { Wrapper, queryClient } = createWrapper(client);
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useToggleWatchlist(), { wrapper: Wrapper });
    act(() => {
      result.current.mutate({ symbol: 'AAPL', watched: false });
      result.current.mutate({ symbol: 'TSLA', watched: false });
    });

    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.watchlist });
    });
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

  it('keeps the order stocks were added in, not the market order', async () => {
    const { Wrapper } = createWrapper(
      createTestClient({
        getWatchlist: () => Promise.resolve({ symbols: ['TSLA', 'AAPL', 'NVDA'] }),
        listStocks: () =>
          Promise.resolve({ items: [makeStock('AAPL'), makeStock('NVDA'), makeStock('TSLA')] }),
      }),
    );

    const { result } = renderHook(() => useWatchlistStocks(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.rows.map((s) => s.symbol)).toEqual(['TSLA', 'AAPL', 'NVDA']);
    });
  });

  it('skips a watched symbol that is missing from the stock list', async () => {
    const { Wrapper } = createWrapper(
      createTestClient({
        getWatchlist: () => Promise.resolve({ symbols: ['INTC', 'AAPL'] }),
        listStocks: () => Promise.resolve({ items: [makeStock('AAPL')] }),
      }),
    );

    const { result } = renderHook(() => useWatchlistStocks(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.rows.map((s) => s.symbol)).toEqual(['AAPL']);
    });
    expect(result.current.symbols).toEqual(['INTC', 'AAPL']);
  });
});

describe('useWatchlistStocks with a sort', () => {
  it('sorts the watched stocks instead of keeping the added order', async () => {
    const { Wrapper } = createWrapper(
      createTestClient({
        getWatchlist: () => Promise.resolve({ symbols: ['TSLA', 'AAPL'] }),
        listStocks: () => Promise.resolve({ items: [makeStock('AAPL'), makeStock('TSLA')] }),
      }),
    );

    const { result } = renderHook(() => useWatchlistStocks({ sort: SORTS[0] }), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.rows.map((s) => s.symbol)).toEqual(['AAPL', 'TSLA']);
    });
  });
});

describe('useWatchToggle', () => {
  it('stars one symbol optimistically', async () => {
    const addToWatchlist = jest.fn(() => new Promise<void>(() => undefined));
    const client = createTestClient({
      getWatchlist: () => Promise.resolve({ symbols: [] }),
      addToWatchlist,
    });
    const { Wrapper } = createWrapper(client);
    const { result } = renderHook(() => useWatchToggle('AAPL'), { wrapper: Wrapper });
    await waitFor(() => {
      expect(result.current.watched).toBe(false);
    });

    act(() => {
      result.current.toggle();
    });

    await waitFor(() => {
      expect(result.current.watched).toBe(true);
    });
    expect(addToWatchlist).toHaveBeenCalledWith('AAPL');
  });
});

describe('useUndoableRemove', () => {
  // A tiny fake server, so the refetch after a delete reflects what was really removed.
  function serverWith(symbols: string[], { failDelete = false } = {}) {
    let saved = [...symbols];
    const removeFromWatchlist = jest.fn((symbol: string) => {
      if (failDelete) return Promise.reject(makeProblem(503));
      saved = saved.filter((s) => s !== symbol);
      return Promise.resolve();
    });
    const addToWatchlist = jest.fn(() => Promise.resolve());
    const client = createTestClient({
      getWatchlist: () => Promise.resolve({ symbols: saved }),
      removeFromWatchlist,
      addToWatchlist,
    });
    return { client, removeFromWatchlist, addToWatchlist };
  }

  function renderWatchlist(client: ReturnType<typeof createTestClient>) {
    const { Wrapper } = createWrapper(client);
    return renderHook(
      () => ({
        removal: useUndoableRemove(),
        toggle: useToggleWatchlist(),
        list: useWatchlist().data,
        tslaWatched: useIsWatched('TSLA'),
      }),
      { wrapper: Wrapper },
    );
  }

  it('hides the stock everywhere while pending and puts it back in place on undo', async () => {
    const { client, removeFromWatchlist } = serverWith(['AAPL', 'TSLA', 'JPM']);
    const { result } = renderWatchlist(client);
    await waitFor(() => {
      expect(result.current.list).toEqual(['AAPL', 'TSLA', 'JPM']);
    });

    act(() => {
      result.current.removal.remove('TSLA');
    });
    expect(result.current.removal.pending).toBe('TSLA');
    expect(result.current.list).toEqual(['AAPL', 'JPM']);
    expect(result.current.tslaWatched).toBe(false);

    act(() => {
      result.current.removal.undo();
    });

    expect(result.current.list).toEqual(['AAPL', 'TSLA', 'JPM']);
    expect(removeFromWatchlist).not.toHaveBeenCalled();
  });

  it('sends the delete when the window closes and keeps the row gone', async () => {
    const { client, removeFromWatchlist } = serverWith(['AAPL', 'TSLA']);
    const { result } = renderWatchlist(client);
    await waitFor(() => {
      expect(result.current.list).toHaveLength(2);
    });

    act(() => {
      result.current.removal.remove('TSLA');
    });
    act(() => {
      result.current.removal.dismiss();
    });

    expect(result.current.removal.pending).toBeNull();
    expect(result.current.list).toEqual(['AAPL']);
    await waitFor(() => {
      expect(removeFromWatchlist).toHaveBeenCalledWith('TSLA');
    });
  });

  it('brings the row back from the server when the delete fails', async () => {
    const { client } = serverWith(['AAPL', 'TSLA'], { failDelete: true });
    const { result } = renderWatchlist(client);
    await waitFor(() => {
      expect(result.current.list).toHaveLength(2);
    });

    act(() => {
      result.current.removal.remove('TSLA');
    });
    act(() => {
      result.current.removal.dismiss();
    });

    await waitFor(() => {
      expect(result.current.list).toEqual(['AAPL', 'TSLA']);
    });
  });

  it('cancels the pending delete without a request when the stock is starred again', async () => {
    const { client, removeFromWatchlist, addToWatchlist } = serverWith(['AAPL', 'TSLA']);
    const { result } = renderWatchlist(client);
    await waitFor(() => {
      expect(result.current.list).toHaveLength(2);
    });

    act(() => {
      result.current.removal.remove('TSLA');
    });
    act(() => {
      result.current.toggle.mutate({ symbol: 'TSLA', watched: result.current.tslaWatched });
    });

    expect(result.current.removal.pending).toBeNull();
    expect(result.current.list).toEqual(['AAPL', 'TSLA']);
    expect(addToWatchlist).not.toHaveBeenCalled();
    expect(removeFromWatchlist).not.toHaveBeenCalled();
  });
});
