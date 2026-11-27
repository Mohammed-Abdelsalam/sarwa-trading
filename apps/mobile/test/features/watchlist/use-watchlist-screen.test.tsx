import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { type ReactNode } from 'react';

import { type StockWithQuote } from '@sarwa/contracts';
import {
  type ApiClient,
  createLiveStore,
  createRemovalQueue,
  SarwaProvider,
  SORTS,
} from '@sarwa/core';

import { useWatchlistScreen } from '../../../src/features/watchlist/use-watchlist-screen';

function stock(symbol: string): StockWithQuote {
  return {
    symbol,
    name: symbol,
    sector: 'tech',
    exchange: 'NASDAQ',
    currency: 'USD',
    sparkline: [1, 2],
    marketCap: 1,
    quote: {
      symbol,
      price: 10,
      prevClose: 9,
      bid: 9.99,
      ask: 10.01,
      bidSize: 300,
      askSize: 200,
      open: 9,
      dayHigh: 10,
      dayLow: 9,
      volume: 1,
      ts: 1,
      seq: 1,
    },
  };
}

// The real core hooks over a fake API, so undo is checked end to end, request by request.
async function renderScreenHook() {
  const removeFromWatchlist = jest.fn(() => Promise.resolve());
  const addToWatchlist = jest.fn(() => Promise.resolve());
  const api = {
    getWatchlist: () => Promise.resolve({ symbols: ['TSLA', 'AAPL', 'NVDA'] }),
    listStocks: () => Promise.resolve({ items: [stock('AAPL'), stock('NVDA'), stock('TSLA')] }),
    removeFromWatchlist,
    addToWatchlist,
  } as Partial<ApiClient> as ApiClient;
  const client = {
    api,
    store: createLiveStore(),
    market: {
      connect: jest.fn(),
      disconnect: jest.fn(),
      acquire: jest.fn(() => jest.fn()),
      subscribedSymbols: () => [],
      onTradingEvent: () => () => undefined,
    },
    storage: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
    removals: createRemovalQueue(),
    analytics: { track: jest.fn() },
    newId: () => 'test-idempotency-key',
  };
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <SarwaProvider client={client}>{children}</SarwaProvider>
    </QueryClientProvider>
  );
  const view = await renderHook(() => useWatchlistScreen(), { wrapper });
  await waitFor(() => {
    expect(view.result.current.rows).toHaveLength(3);
  });
  return { ...view, removeFromWatchlist, addToWatchlist };
}

const symbols = (rows: { symbol: string }[]) => rows.map((row) => row.symbol);

describe('useWatchlistScreen', () => {
  it('puts a removed stock back in its place on undo, without any request', async () => {
    const { result, removeFromWatchlist, addToWatchlist } = await renderScreenHook();

    await act(() => {
      result.current.actions.remove('AAPL');
    });
    expect(result.current.removed).toBe('AAPL');
    expect(symbols(result.current.rows)).toEqual(['TSLA', 'NVDA']);
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);

    await act(() => {
      result.current.actions.undo();
    });

    expect(symbols(result.current.rows)).toEqual(['TSLA', 'AAPL', 'NVDA']);
    expect(removeFromWatchlist).not.toHaveBeenCalled();
    expect(addToWatchlist).not.toHaveBeenCalled();
  });

  it('cycles the sort from the added order through every option', async () => {
    const { result } = await renderScreenHook();

    await act(() => {
      result.current.actions.cycleSort();
    });

    expect(result.current.sort).toBe(SORTS[0]);
    expect(symbols(result.current.rows)).toEqual(['AAPL', 'NVDA', 'TSLA']);
  });
});
