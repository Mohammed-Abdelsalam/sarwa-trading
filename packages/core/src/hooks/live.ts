import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useStore } from 'zustand';

import { type MarketStatus, type Quote } from '@sarwa/contracts';

import { averageChangePct } from '../markets';
import { useSarwa } from '../provider';
import { isStale, type LiveStatus, liveStatus } from '../status';
import { type ConnectionState } from '../store';
import { queryKeys } from './keys';

export function useQuote(symbol: string): Quote | undefined {
  const { store } = useSarwa();
  return useStore(store, (state) => state.quotes[symbol]);
}

export function useLiveSymbols(symbols: readonly string[]): void {
  const { market } = useSarwa();
  const key = symbols.join(',');
  useEffect(() => (key ? market.acquire(key.split(',')) : undefined), [market, key]);
}

export function useConnection(): ConnectionState {
  const { store } = useSarwa();
  return useStore(store, (state) => state.connection);
}

export function useMarketStatus(): MarketStatus | null {
  const { store } = useSarwa();
  return useStore(store, (state) => state.marketStatus);
}

export function useLiveStatus(): LiveStatus {
  return liveStatus(useConnection(), useMarketStatus());
}

export function useIsStale(): boolean {
  return isStale(useLiveStatus());
}

export function useAverageChange(symbols: readonly string[]): number | null {
  const { store } = useSarwa();
  return useStore(store, (state) =>
    averageChangePct(symbols.flatMap((s) => state.quotes[s] ?? [])),
  );
}

// The socket lives only while the app is visible and online: no wasted battery or data.
export function useMarketConnection({
  foreground,
  online,
}: {
  foreground: boolean;
  online: boolean;
}): void {
  const { market, store } = useSarwa();

  useEffect(() => {
    if (foreground && online) {
      market.connect();
      return;
    }
    market.disconnect();
    if (!online) store.getState().setConnection({ status: 'offline' });
  }, [foreground, online, market, store]);

  useEffect(
    () => () => {
      market.disconnect();
    },
    [market],
  );
}

// Admin stock changes (enable, disable, add, delete) refresh the lists right away instead of after staleTime.
export function useSyncStocksOnChange(): void {
  const { store } = useSarwa();
  const queryClient = useQueryClient();
  const changedAt = useStore(store, (state) => state.stocksChangedAt);

  useEffect(() => {
    if (changedAt !== null) void queryClient.invalidateQueries({ queryKey: queryKeys.stocks });
  }, [changedAt, queryClient]);
}
