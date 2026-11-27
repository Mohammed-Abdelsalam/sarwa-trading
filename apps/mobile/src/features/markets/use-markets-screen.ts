import { useDeferredValue, useState } from 'react';

import {
  DEFAULT_SORT,
  nextSort,
  SECTOR_FILTERS,
  type SectorFilter,
  useLiveStatus,
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
  const status = useLiveStatus();
  const { mutate: toggle } = useToggleWatchlist();

  // Only on-screen rows stream prices; scrolling swaps the subscription set.
  useLiveSymbols(visibleSymbols);

  return {
    rows,
    watched,
    stale: status === 'offline' || status === 'paused',
    isLoading,
    isError,
    isRefreshing,
    filters: {
      query,
      sector,
      sectorLabel: SECTOR_FILTERS.find((f) => f.id === sector)?.label ?? 'All',
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
