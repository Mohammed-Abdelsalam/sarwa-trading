import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';

import { SarwaProvider, SORTS } from '@sarwa/core';

import { useWatchlistPage } from '../../../src/features/watchlist/use-watchlist-page';
import { createTestClient, makeStock } from '../../fixtures';

function renderPage() {
  const removeFromWatchlist = jest.fn(() => Promise.resolve());
  const addToWatchlist = jest.fn(() => Promise.resolve());
  const client = createTestClient({
    getWatchlist: () => Promise.resolve({ symbols: ['TSLA', 'AAPL', 'NVDA'] }),
    listStocks: () =>
      Promise.resolve({ items: [makeStock('AAPL'), makeStock('NVDA'), makeStock('TSLA')] }),
    removeFromWatchlist,
    addToWatchlist,
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <SarwaProvider client={client}>{children}</SarwaProvider>
    </QueryClientProvider>
  );
  const view = renderHook(() => useWatchlistPage(), { wrapper });
  return { ...view, client, removeFromWatchlist, addToWatchlist };
}

const symbols = (rows: { symbol: string }[]) => rows.map((row) => row.symbol);

describe('useWatchlistPage', () => {
  it('hides a removed stock and offers undo until the delete is sent', async () => {
    const { result, removeFromWatchlist } = renderPage();
    await waitFor(() => {
      expect(symbols(result.current.rows)).toEqual(['TSLA', 'AAPL', 'NVDA']);
    });

    act(() => {
      result.current.actions.remove('AAPL');
    });
    expect(result.current.removed).toBe('AAPL');
    expect(symbols(result.current.rows)).toEqual(['TSLA', 'NVDA']);

    act(() => {
      result.current.actions.dismissUndo();
    });
    expect(result.current.removed).toBeNull();
    await waitFor(() => {
      expect(removeFromWatchlist).toHaveBeenCalledWith('AAPL');
    });
  });

  it('puts the stock back in its place on undo without any request', async () => {
    const { result, removeFromWatchlist, addToWatchlist } = renderPage();
    await waitFor(() => {
      expect(result.current.rows).toHaveLength(3);
    });

    act(() => {
      result.current.actions.remove('AAPL');
    });
    act(() => {
      result.current.actions.undo();
    });

    expect(symbols(result.current.rows)).toEqual(['TSLA', 'AAPL', 'NVDA']);
    expect(removeFromWatchlist).not.toHaveBeenCalled();
    expect(addToWatchlist).not.toHaveBeenCalled();
  });

  it('sorts by a column and returns to the added order', async () => {
    const { result } = renderPage();
    await waitFor(() => {
      expect(result.current.rows).toHaveLength(3);
    });

    act(() => {
      result.current.actions.sortBy('name');
    });
    expect(result.current.sort).toBe(SORTS[0]);
    expect(symbols(result.current.rows)).toEqual(['AAPL', 'NVDA', 'TSLA']);

    act(() => {
      result.current.actions.setSort(null);
    });
    expect(symbols(result.current.rows)).toEqual(['TSLA', 'AAPL', 'NVDA']);
  });

  it('marks prices stale while offline', async () => {
    const { result, client } = renderPage();

    act(() => {
      client.store.getState().setConnection({ status: 'offline' });
    });

    await waitFor(() => {
      expect(result.current.stale).toBe(true);
    });
  });
});
