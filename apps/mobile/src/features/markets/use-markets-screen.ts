import { useDeferredValue, useState } from 'react';

import {
  DEFAULT_SORT,
  filterAndSort,
  nextSort,
  type SectorFilter,
  useLiveSymbols,
  useStocks,
  useToggleWatchlist,
  useWatchlist,
} from '@sarwa/core';

export function useMarketsScreen() {
  const stocks = useStocks();
  const watchlist = useWatchlist();
  const { mutate: toggle } = useToggleWatchlist();
  const [query, setQuery] = useState('');
  const [sector, setSector] = useState<SectorFilter>('all');
  const [sort, setSort] = useState(DEFAULT_SORT);
  const [visibleSymbols, setVisibleSymbols] = useState<string[]>([]);
  const searchedQuery = useDeferredValue(query);

  // Only on-screen rows stream prices; scrolling swaps the subscription set.
  useLiveSymbols(visibleSymbols);

  return {
    rows: filterAndSort(stocks.data ?? [], { query: searchedQuery, sector, sort }),
    watched: new Set(watchlist.data),
    watchlistVersion: watchlist.data,
    isLoading: stocks.isPending,
    isError: stocks.isError && !stocks.data,
    isRefreshing: stocks.isRefetching,
    filters: { query, sector, sort, searchedQuery },
    actions: {
      setQuery,
      setSector,
      cycleSort: () => {
        setSort(nextSort);
      },
      clearFilters: () => {
        setQuery('');
        setSector('all');
      },
      refresh: () => void stocks.refetch(),
      setVisibleSymbols,
      toggleWatch: (symbol: string, watched: boolean) => {
        toggle({ symbol, watched });
      },
    },
  };
}
