import { act, renderHook, waitFor } from '@testing-library/react';

import { ApiError } from './api';
import { queryKeys, useStocks, useToggleWatchlist } from './hooks';
import { createTestClient, createWrapper, makeQuote } from './test-utils';

describe('useStocks', () => {
  it('seeds the live store with the REST snapshot', async () => {
    const quote = makeQuote({ symbol: 'NVDA' });
    const client = createTestClient({
      listStocks: () =>
        Promise.resolve({
          items: [
            {
              symbol: 'NVDA',
              name: 'NVIDIA',
              sector: 'tech',
              exchange: 'NASDAQ',
              currency: 'USD',
              quote,
            },
          ],
        }),
    });
    const { Wrapper } = createWrapper(client);

    const { result } = renderHook(() => useStocks(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(client.store.getState().quotes.NVDA).toEqual(quote);
  });
});

describe('useToggleWatchlist', () => {
  it('updates the watchlist optimistically', async () => {
    let resolve!: () => void;
    const client = createTestClient({
      addToWatchlist: () => new Promise<void>((r) => (resolve = r)),
      getWatchlist: () => Promise.resolve({ symbols: ['AAPL'] }),
    });
    const { Wrapper, queryClient } = createWrapper(client);
    queryClient.setQueryData(queryKeys.watchlist, []);

    const { result } = renderHook(() => useToggleWatchlist(), { wrapper: Wrapper });
    act(() => {
      result.current.mutate({ symbol: 'AAPL', watched: false });
    });

    await waitFor(() => {
      expect(queryClient.getQueryData(queryKeys.watchlist)).toEqual(['AAPL']);
    });
    resolve();
  });

  it('rolls back when the request fails', async () => {
    const client = createTestClient({
      removeFromWatchlist: () =>
        Promise.reject(
          new ApiError({ type: 'about:blank', title: 'Error', status: 503, code: 'MAINTENANCE' }),
        ),
      getWatchlist: () => Promise.resolve({ symbols: ['AAPL', 'TSLA'] }),
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
});
