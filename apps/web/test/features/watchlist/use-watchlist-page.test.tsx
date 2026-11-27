import { act, renderHook } from '@testing-library/react';

import { useLiveStatus, useToggleWatchlist, useWatchlistStocks } from '@sarwa/core';

import { useWatchlistPage } from '../../../src/features/watchlist/use-watchlist-page';
import { makeStock } from '../../fixtures';

jest.mock('@sarwa/core', () => ({
  ...jest.requireActual<object>('@sarwa/core'),
  useWatchlistStocks: jest.fn(),
  useLiveStatus: jest.fn(),
  useToggleWatchlist: jest.fn(),
}));

const mutate = jest.fn();

beforeEach(() => {
  jest.useFakeTimers();
  jest.mocked(useWatchlistStocks).mockReturnValue({
    rows: [makeStock('AAPL')],
    symbols: ['AAPL'],
    average: 1,
    isLoading: false,
    isError: false,
    retry: jest.fn(),
  });
  jest.mocked(useLiveStatus).mockReturnValue('live');
  jest
    .mocked(useToggleWatchlist)
    .mockReturnValue({ mutate } as unknown as ReturnType<typeof useToggleWatchlist>);
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useWatchlistPage', () => {
  it('removes a stock and hides the undo offer after five seconds', () => {
    const { result } = renderHook(() => useWatchlistPage());

    act(() => {
      result.current.actions.remove('AAPL');
    });
    expect(mutate).toHaveBeenCalledWith({ symbol: 'AAPL', watched: true });
    expect(result.current.removed).toBe('AAPL');

    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(result.current.removed).toBeNull();
  });

  it('stars the stock again when undo is pressed', () => {
    const { result } = renderHook(() => useWatchlistPage());

    act(() => {
      result.current.actions.remove('AAPL');
    });
    act(() => {
      result.current.actions.undo();
    });

    expect(mutate).toHaveBeenLastCalledWith({ symbol: 'AAPL', watched: false });
    expect(result.current.removed).toBeNull();
  });

  it('marks prices stale while the market is offline', () => {
    jest.mocked(useLiveStatus).mockReturnValue('offline');

    const { result } = renderHook(() => useWatchlistPage());

    expect(result.current.stale).toBe(true);
  });
});
