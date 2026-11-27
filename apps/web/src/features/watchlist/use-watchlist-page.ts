import { useState } from 'react';

import {
  type SortKey,
  sortByColumn,
  type SortOption,
  useI18n,
  useIsStale,
  useSession,
  useUndoableRemove,
  useWatchlistStocks,
} from '@sarwa/core';
import { useLocalPreference } from '@sarwa/ui';

export type WatchlistView = 'table' | 'grid';
const VIEWS: readonly WatchlistView[] = ['table', 'grid'];

export function useWatchlistPage() {
  const { t } = useI18n();
  const { status, isGuest } = useSession();
  const [sort, setSort] = useState<SortOption | null>(null);
  const { rows, average, isLoading, isError, retry } = useWatchlistStocks({ sort });
  const stale = useIsStale();
  const removal = useUndoableRemove();
  const [view, setView] = useLocalPreference('sarwa.watchlist.view', VIEWS, 'table');

  return {
    rows,
    average,
    stale,
    // The list waits for the session, then a guest's comes from the device account.
    isLoading: isLoading || status === 'loading',
    isError,
    guest: isGuest,
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
