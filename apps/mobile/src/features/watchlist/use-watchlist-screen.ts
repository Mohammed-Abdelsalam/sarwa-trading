import { useToggleWatchlist, useWatchlistStocks } from '@sarwa/core';

export function useWatchlistScreen() {
  const { rows, average, isLoading, isError, retry } = useWatchlistStocks();
  const { mutate: toggle } = useToggleWatchlist();

  return {
    rows,
    average,
    isLoading,
    isError,
    retry,
    remove: (symbol: string) => {
      toggle({ symbol, watched: true });
    },
  };
}
