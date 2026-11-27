import { useState } from 'react';

import {
  type SortKey,
  sortByColumn,
  type SortOption,
  useI18n,
  useIsStale,
  useUndoableRemove,
  useWatchlistStocks,
} from '@sarwa/core';

import { useLocalPreference } from '../../lib/browser';

export type WatchlistView = 'table' | 'grid';
const VIEWS: readonly WatchlistView[] = ['table', 'grid'];

export function useWatchlistPage() {
  const { t } = useI18n();
  const [sort, setSort] = useState<SortOption | null>(null);
  const { rows, average, isLoading, isError, retry } = useWatchlistStocks({ sort });
  const stale = useIsStale();
  const removal = useUndoableRemove();
  const [view, setView] = useLocalPreference('sarwa.watchlist.view', VIEWS, 'table');

  return {
    rows,
    average,
    stale,
    isLoading,
    isError,
    view,
    sort,
    removed: removal.pending,
    dismissLabel: t.common.dismiss,
    actions: {
      retry,
      setView,
      setSort,
      sortBy: (key: SortKey) => {
        setSort((current) => sortByColumn(current, key));
      },
      remove: removal.remove,
      undo: removal.undo,
      dismissUndo: removal.dismiss,
    },
  };
}
