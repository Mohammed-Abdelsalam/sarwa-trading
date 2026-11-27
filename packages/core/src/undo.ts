export interface RemovalQueue {
  getPending: () => string | null;
  subscribe: (listener: () => void) => () => void;
  schedule: (symbol: string, commit: () => void) => void;
  undo: () => void;
  flush: () => void;
}

// One pending removal at a time, held outside React so every screen agrees and the timer survives
// unmounts. If the app is killed inside the window the delete never runs: the stock stays watched.
export function createRemovalQueue(timeoutMs = 5_000): RemovalQueue {
  let pending: { symbol: string; commit: () => void; timer: ReturnType<typeof setTimeout> } | null =
    null;
  const listeners = new Set<() => void>();
  const notify = () => {
    listeners.forEach((listener) => {
      listener();
    });
  };

  const settle = (commit: boolean) => {
    if (!pending) return;
    clearTimeout(pending.timer);
    // Commit before clearing, so the row is already gone from the cache when it stops being hidden.
    if (commit) pending.commit();
    pending = null;
    notify();
  };

  return {
    getPending: () => pending?.symbol ?? null,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    schedule: (symbol, commit) => {
      settle(true);
      pending = {
        symbol,
        commit,
        timer: setTimeout(() => {
          settle(true);
        }, timeoutMs),
      };
      notify();
    },
    undo: () => {
      settle(false);
    },
    flush: () => {
      settle(true);
    },
  };
}
