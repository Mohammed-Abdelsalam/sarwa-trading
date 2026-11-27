import * as Haptics from 'expo-haptics';
import { useState } from 'react';

import {
  nextWatchlistSort,
  type SortOption,
  useIsStale,
  useUndoableRemove,
  useWatchlistStocks,
} from '@sarwa/core';

export function useWatchlistScreen() {
  const [sort, setSort] = useState<SortOption | null>(null);
  const { rows, average, isLoading, isError, retry } = useWatchlistStocks({ sort });
  const stale = useIsStale();
  const removal = useUndoableRemove();

  return {
    rows,
    average,
    stale,
    isLoading,
    isError,
    sort,
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
    },
  };
}
