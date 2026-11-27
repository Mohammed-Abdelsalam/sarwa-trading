import { useLiveStatus, useToggleWatchlist, useWatchlistStocks } from '@sarwa/core';

export function useWatchlistScreen() {
  const { rows, average, isLoading, isError, retry } = useWatchlistStocks();
  const status = useLiveStatus();
  const { mutate: toggle } = useToggleWatchlist();

  return {
    rows,
    average,
    stale: status === 'offline' || status === 'paused',
    isLoading,
    isError,
    retry,
    remove: (symbol: string) => {
      toggle({ symbol, watched: true });
    },
  };
}
