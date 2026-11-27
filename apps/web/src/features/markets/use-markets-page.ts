import { type Route } from 'next';
import { useRouter } from 'next/navigation';
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
import { breakpoints } from '@sarwa/tokens';

import { replaceSearchParam, useMediaQuery, useSearchParam } from '../../lib/browser';

export function useMarketsPage() {
  const router = useRouter();
  const query = useSearchParam('q') ?? '';
  const requested = useSearchParam('symbol');
  const searchedQuery = useDeferredValue(query);
  const [sector, setSector] = useState<SectorFilter>('all');
  const [sort, setSort] = useState(DEFAULT_SORT);
  const { rows, isLoading, isError, refresh } = useMarketList({
    query: searchedQuery,
    sector,
    sort,
  });
  const watched = useWatchedSymbols();
  const stale = useIsStale();
  const { mutate: toggle } = useToggleWatchlist();
  // Two panes from 1024 px: rows select into the side panel instead of opening a page (W-Markets).
  const twoPane = useMediaQuery(`(min-width: ${String(breakpoints.lg)}px)`);

  // The list is small, so every row streams; selection and search never change what is subscribed.
  useLiveSymbols(rows.map((row) => row.symbol));

  const selected = twoPane
    ? (rows.find((row) => row.symbol === requested) ?? rows[0])?.symbol
    : undefined;

  return {
    rows,
    watched,
    selected,
    twoPane,
    stale,
    isLoading,
    isError,
    filters: {
      query: searchedQuery,
      sector,
      sectorLabel: sectorFilterLabel(sector),
      sort,
    },
    rowHref: (symbol: string): Route =>
      twoPane ? (`/?symbol=${symbol}` as Route) : (`/stocks/${symbol}` as Route),
    actions: {
      setSector,
      cycleSort: () => {
        setSort(nextSort);
      },
      clearFilters: () => {
        replaceSearchParam('q', null);
        setSector('all');
      },
      refresh,
      select: twoPane
        ? (symbol: string) => {
            replaceSearchParam('symbol', symbol);
          }
        : undefined,
      open: (symbol: string) => {
        router.push(`/stocks/${symbol}` as Route);
      },
      toggleWatch: (symbol: string, isWatched: boolean) => {
        toggle({ symbol, watched: isWatched });
      },
    },
  };
}
