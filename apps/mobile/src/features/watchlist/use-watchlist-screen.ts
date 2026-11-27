import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';

import {
  nextWatchlistSort,
  type SortOption,
  useIsStale,
  useUndoableRemove,
  useSession,
  useWatchlistStocks,
} from '@sarwa/core';

export function useWatchlistScreen() {
  const [sort, setSort] = useState<SortOption | null>(null);
  const { rows, average, isLoading, isError, retry } = useWatchlistStocks({ sort });
  const stale = useIsStale();
  const removal = useUndoableRemove();
  const { isGuest, status } = useSession();

  return {
    rows,
    average,
    stale,
    // The watchlist query waits for the session, so a restoring session counts as loading.
    isLoading: isLoading || status === 'loading',
    isError,
    sort,
    isGuest,
    removed: removal.pending,
    actions: {
      retry,
      cycleSort: () => {
        setSort(nextWatchlistSort);
      },
      remove: (symbol: string) => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        removal.remove(symbol);
      },
      undo: removal.undo,
      dismissUndo: removal.dismiss,
      signUp: () => {
        router.push('/sign-up');
      },
    },
  };
}
