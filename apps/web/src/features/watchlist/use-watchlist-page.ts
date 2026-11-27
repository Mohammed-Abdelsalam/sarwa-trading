import { useEffect, useState } from 'react';

import {
  filterAndSort,
  type SortKey,
  sortByColumn,
  type SortOption,
  useLiveStatus,
  useToggleWatchlist,
  useWatchlistStocks,
} from '@sarwa/core';

import { useLocalPreference } from '../../lib/browser';

export type WatchlistView = 'table' | 'grid';
const VIEWS: readonly WatchlistView[] = ['table', 'grid'];
const UNDO_MS = 5000;

export function useWatchlistPage() {
  const { rows, average, isLoading, isError, retry } = useWatchlistStocks();
  const status = useLiveStatus();
  const { mutate: toggle } = useToggleWatchlist();
  const [view, setView] = useLocalPreference('sarwa.watchlist.view', VIEWS, 'table');
  // null keeps the server order: the order the stocks were starred in.
  const [sort, setSort] = useState<SortOption | null>(null);
  const [removed, setRemoved] = useState<string | null>(null);

  useEffect(() => {
    if (!removed) return;
    const timer = setTimeout(() => {
      setRemoved(null);
    }, UNDO_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [removed]);

  return {
    rows: sort ? filterAndSort(rows, { query: '', sector: 'all', sort }) : rows,
    average,
    stale: status === 'offline' || status === 'paused',
    isLoading,
    isError,
    view,
    sort,
    removed,
    actions: {
      retry,
      setView,
      setSort,
      sortBy: (key: SortKey) => {
        setSort((current) => sortByColumn(current, key));
      },
      remove: (symbol: string) => {
        toggle({ symbol, watched: true });
        setRemoved(symbol);
      },
      undo: () => {
        if (removed) toggle({ symbol: removed, watched: false });
        setRemoved(null);
      },
      dismissUndo: () => {
        setRemoved(null);
      },
    },
  };
}
