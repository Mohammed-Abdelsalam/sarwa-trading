import { useDeferredValue, useState } from 'react';

import {
  DEFAULT_SORT,
  nextSort,
  sectorFilterLabel,
  type SectorFilter,
  useIsStale,
  useLiveSymbols,
  useMarketList,
  useToggleWatchlist,
  useWatchedSymbols,
} from '@sarwa/core';

export function useMarketsScreen() {
  const [query, setQuery] = useState('');
  const [sector, setSector] = useState<SectorFilter>('all');
  const [sort, setSort] = useState(DEFAULT_SORT);
  const [visibleSymbols, setVisibleSymbols] = useState<string[]>([]);
  const searchedQuery = useDeferredValue(query);
  const { rows, isLoading, isError, isRefreshing, refresh } = useMarketList({
    query: searchedQuery,
    sector,
    sort,
  });
  const watched = useWatchedSymbols();
  const stale = useIsStale();
  const { mutate: toggle } = useToggleWatchlist();

  // Only on-screen rows stream prices; scrolling swaps the subscription set.
  useLiveSymbols(visibleSymbols);

  return {
    rows,
    watched,
    stale,
    isLoading,
    isError,
    isRefreshing,
    filters: {
      query,
      sector,
      sectorLabel: sectorFilterLabel(sector),
      sort,
      searchedQuery,
      searchDisabled: isLoading || isError,
    },
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
      refresh,
      setVisibleSymbols,
      toggleWatch: (symbol: string, watched: boolean) => {
        toggle({ symbol, watched });
      },
    },
  };
}
