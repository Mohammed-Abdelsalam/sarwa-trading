import { useIsWatched, useToggleWatchlist } from '@sarwa/core';

export function useRemovedStock(symbol: string) {
  const watched = useIsWatched(symbol);
  const { mutate: toggle } = useToggleWatchlist();

  return {
    watched,
    removeFromWatchlist: () => {
      toggle({ symbol, watched: true });
    },
  };
}
