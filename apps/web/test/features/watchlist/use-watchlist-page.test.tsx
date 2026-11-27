import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';

import { type ClientAuth, SarwaProvider, SORTS } from '@sarwa/core';

import { useWatchlistPage } from '../../../src/features/watchlist/use-watchlist-page';
import { createTestClient, makeStock, makeUser, testAuth } from '../../fixtures';

function renderPage(auth?: ClientAuth) {
  const removeFromWatchlist = jest.fn(() => Promise.resolve());
  const addToWatchlist = jest.fn(() => Promise.resolve());
  const client = createTestClient(
    {
      getWatchlist: () => Promise.resolve({ symbols: ['TSLA', 'AAPL', 'NVDA'] }),
      listStocks: () =>
        Promise.resolve({ items: [makeStock('AAPL'), makeStock('NVDA'), makeStock('TSLA')] }),
      removeFromWatchlist,
      addToWatchlist,
    },
    auth,
  );
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

  it("loads a guest's list and flags them for the account note", async () => {
    const { result } = renderPage(testAuth());
    await waitFor(() => {
      expect(result.current.rows).toHaveLength(3);
    });
    expect(result.current.guest).toBe(true);
  });

  it("shows the skeleton while the session is loading, then the member's list", async () => {
    const auth = testAuth({ status: 'loading' });
    const { result } = renderPage(auth);
    expect(result.current.isLoading).toBe(true);
    expect(result.current.guest).toBe(false);

    act(() => {
      auth.session.getState().signIn(makeUser());
    });
    await waitFor(() => {
      expect(result.current.rows).toHaveLength(3);
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.guest).toBe(false);
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
