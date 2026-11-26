import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { useStore } from 'zustand';

import {
  type AppConfig,
  type Candle,
  type MarketStatus,
  type Period,
  type Quote,
  type StockDetailResponse,
  type StockWithQuote,
} from '@sarwa/contracts';

import { averageChangePct } from './markets';
import { useSarwa } from './provider';
import { type AppNotice, appNotices, type LiveStatus, liveStatus } from './status';
import { type ConnectionState } from './store';

export const queryKeys = {
  stocks: ['stocks'] as const,
  stock: (symbol: string) => ['stocks', symbol] as const,
  candles: (symbol: string, period: Period) => ['stocks', symbol, 'candles', period] as const,
  watchlist: ['watchlist'] as const,
  appConfig: ['app-config'] as const,
};

export function useStocks(): UseQueryResult<StockWithQuote[]> {
  const { api, store } = useSarwa();
  return useQuery({
    queryKey: queryKeys.stocks,
    queryFn: async () => {
      const { items } = await api.listStocks();
      store.getState().applyQuotes(items.map((item) => item.quote));
      return items;
    },
    staleTime: 30_000,
  });
}

export function useStock(symbol: string): UseQueryResult<StockDetailResponse> {
  const { api, store } = useSarwa();
  return useQuery({
    queryKey: queryKeys.stock(symbol),
    queryFn: async () => {
      const detail = await api.getStock(symbol);
      store.getState().applyQuotes([detail.quote]);
      return detail;
    },
    staleTime: 30_000,
  });
}

export function useCandles(symbol: string, period: Period): UseQueryResult<Candle[]> {
  const { api } = useSarwa();
  return useQuery({
    queryKey: queryKeys.candles(symbol, period),
    queryFn: async () => (await api.getCandles(symbol, period)).candles,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export function useWatchlist(): UseQueryResult<string[]> {
  const { api } = useSarwa();
  return useQuery({
    queryKey: queryKeys.watchlist,
    queryFn: async () => (await api.getWatchlist()).symbols,
  });
}

export function useIsWatched(symbol: string): boolean {
  const { data } = useWatchlist();
  return data?.includes(symbol) ?? false;
}

export function useToggleWatchlist() {
  const { api } = useSarwa();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ symbol, watched }: { symbol: string; watched: boolean }) =>
      watched ? api.removeFromWatchlist(symbol) : api.addToWatchlist(symbol),
    onMutate: async ({ symbol, watched }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.watchlist });
      const previous = queryClient.getQueryData<string[]>(queryKeys.watchlist);
      queryClient.setQueryData<string[]>(queryKeys.watchlist, (list = []) =>
        watched ? list.filter((s) => s !== symbol) : [...list, symbol],
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(queryKeys.watchlist, context?.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.watchlist }),
  });
}

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

export function useAppNotices(): { notices: AppNotice[]; dismiss: (notice: AppNotice) => void } {
  const connection = useConnection();
  const market = useMarketStatus();
  const banner = useAppConfig()?.banner;
  const [dismissed, setDismissed] = useState<string | null>(null);

  return {
    notices: appNotices({
      connection,
      market,
      banner: banner?.message === dismissed ? null : banner,
    }),
    dismiss: (notice) => {
      setDismissed(notice.message);
    },
  };
}

export function useAverageChange(symbols: readonly string[]): number | null {
  const { store } = useSarwa();
  return useStore(store, (state) =>
    averageChangePct(symbols.flatMap((s) => state.quotes[s] ?? [])),
  );
}

export function useRefreshAppConfig({ every }: { every?: number } = {}): () => void {
  const queryClient = useQueryClient();
  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.appConfig });
  }, [queryClient]);

  useEffect(() => {
    if (!every) return;
    const timer = setInterval(refresh, every);
    return () => {
      clearInterval(timer);
    };
  }, [every, refresh]);

  return refresh;
}

export function useAppConfig(): AppConfig | undefined {
  const { api, store } = useSarwa();
  const live = useStore(store, (state) => state.appConfig);
  const { data } = useQuery({
    queryKey: queryKeys.appConfig,
    queryFn: () => api.getAppConfig(),
    staleTime: 60_000,
  });
  if (!live) return data;
  if (!data) return live;
  return live.updatedAt >= data.updatedAt ? live : data;
}
