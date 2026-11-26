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
    remove: (symbol: string) => {
      toggle({ symbol, watched: true });
    },
  };
}
