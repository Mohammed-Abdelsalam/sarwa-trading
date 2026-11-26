import {
  useAverageChange,
  useLiveSymbols,
  useStocks,
  useToggleWatchlist,
  useWatchlist,
} from '@sarwa/core';

export function useWatchlistScreen() {
  const watchlist = useWatchlist();
  const stocks = useStocks();
  const { mutate: toggle } = useToggleWatchlist();

  const symbols = watchlist.data ?? [];
  const average = useAverageChange(symbols);
  useLiveSymbols(symbols);

  return {
    rows: (stocks.data ?? []).filter((stock) => symbols.includes(stock.symbol)),
    average,
    isLoading: watchlist.isPending || stocks.isPending,
    // Only a failure without cached data is an error; otherwise the cached list keeps showing.
    isError: (watchlist.isError && !watchlist.data) || (stocks.isError && !stocks.data),
    retry: () => {
      if (watchlist.isError) void watchlist.refetch();
      if (stocks.isError) void stocks.refetch();
    },
    remove: (symbol: string) => {
      toggle({ symbol, watched: true });
    },
  };
}
