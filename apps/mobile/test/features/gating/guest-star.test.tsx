import { act, renderHook, waitFor } from '@testing-library/react-native';
import { type ReactNode } from 'react';

import { useMarketsScreen } from '../../../src/features/markets/use-markets-screen';
import { useStockDetailScreen } from '../../../src/features/stock-detail/use-stock-detail-screen';
import { mockApi, Providers, testAuth } from '../../render';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

// The real core hooks for a guest: a star is saved straight away, never behind the sign-in gate.
async function renderAsGuest<T>(hook: () => T) {
  const auth = testAuth();
  const addToWatchlist = jest.fn(() => Promise.resolve());
  const api = mockApi({ getWatchlist: () => Promise.resolve({ symbols: [] }), addToWatchlist });
  const view = await renderHook(hook, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <Providers api={api} auth={auth}>
        {children}
      </Providers>
    ),
  });
  return { ...view, auth, addToWatchlist };
}

describe('a guest starring a stock', () => {
  it('saves it from the Markets list without the gate', async () => {
    const { result, auth, addToWatchlist } = await renderAsGuest(() => useMarketsScreen());

    await act(() => {
      result.current.actions.toggleWatch('NVDA', false);
    });

    await waitFor(() => {
      expect(addToWatchlist).toHaveBeenCalledWith('NVDA');
    });
    expect(auth.gate.getState().isOpen).toBe(false);
  });

  it('saves it from the stock screen without the gate', async () => {
    const { result, auth, addToWatchlist } = await renderAsGuest(() =>
      useStockDetailScreen('AAPL'),
    );

    await act(() => {
      result.current.actions.toggleWatch();
    });

    await waitFor(() => {
      expect(addToWatchlist).toHaveBeenCalledWith('AAPL');
    });
    expect(auth.gate.getState().isOpen).toBe(false);
  });
});
