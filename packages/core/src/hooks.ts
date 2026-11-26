import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStore } from 'zustand';

import {
  type AppConfig,
  type Candle,
  type MarketStatus,
  type Period,
  PERIODS,
  type Quote,
  type StockDetailResponse,
  type StockWithQuote,
} from '@sarwa/contracts';

import { isNotFound } from './api';
import { axisCandles, chartBaseline, withLiveQuote } from './chart';
import { averageChangePct, filterAndSort, keyStats, type MarketFilter } from './markets';
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
    queryFn: async ({ signal }) => {
      const { items } = await api.listStocks({ signal });
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
    queryFn: async ({ signal }) => {
      const detail = await api.getStock(symbol, { signal });
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
    queryFn: async ({ signal }) => (await api.getCandles(symbol, period, { signal })).candles,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export function useWatchlist(): UseQueryResult<string[]> {
  const { api } = useSarwa();
  return useQuery({
    queryKey: queryKeys.watchlist,
    queryFn: async ({ signal }) => (await api.getWatchlist({ signal })).symbols,
  });
}

export function useIsWatched(symbol: string): boolean {
  const { data } = useWatchlist();
  return data?.includes(symbol) ?? false;
}

export function useWatchedSymbols(): ReadonlySet<string> {
  const { data } = useWatchlist();
  return useMemo(() => new Set(data), [data]);
}

const TOGGLE_WATCHLIST_KEY = ['watchlist', 'toggle'] as const;

export function useToggleWatchlist() {
  const { api } = useSarwa();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: TOGGLE_WATCHLIST_KEY,
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
    // Only the last toggle in flight refetches, so an early refetch can't undo a later optimistic star.
    onSettled: () =>
      queryClient.isMutating({ mutationKey: TOGGLE_WATCHLIST_KEY }) === 1
        ? queryClient.invalidateQueries({ queryKey: queryKeys.watchlist })
        : undefined,
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

export type LoadState = 'loading' | 'error' | 'ready';

export function useEnabledPeriods(): readonly Period[] {
  return useAppConfig()?.enabledPeriods ?? PERIODS;
}

export function useChartSeries(symbol: string, period: Period) {
  const query = useCandles(symbol, period);
  const quote = useQuote(symbol);
  const candles = withLiveQuote(query.data ?? [], quote);
  const baseline = chartBaseline(period, candles, quote);
  const state: LoadState = query.isPending ? 'loading' : query.isError ? 'error' : 'ready';

  return {
    candles,
    baseline,
    showBaseline: period === '1D' && baseline !== null,
    rising: (candles.at(-1)?.c ?? 0) >= (baseline ?? 0),
    axisCandles: axisCandles(candles),
    state,
    retry: () => void query.refetch(),
  };
}

export function useStockDetail(symbol: string) {
  const detail = useStock(symbol);
  const liveQuote = useQuote(symbol);
  useLiveSymbols([symbol]);

  const quote = liveQuote ?? detail.data?.quote;
  const notFound = isNotFound(detail.error);

  return {
    stock: detail.data?.stock,
    quote,
    stats: detail.data && quote ? keyStats(detail.data, quote) : null,
    notFound,
    isError: detail.isError && !detail.data && !notFound,
    retry: () => void detail.refetch(),
  };
}

export function useWatchlistStocks() {
  const watchlist = useWatchlist();
  const stocks = useStocks();
  const symbols = watchlist.data ?? [];
  const average = useAverageChange(symbols);
  useLiveSymbols(symbols);

  return {
    rows: (stocks.data ?? []).filter((stock) => symbols.includes(stock.symbol)),
    symbols,
    average,
    isLoading: watchlist.isPending || stocks.isPending,
    // Only a failure without cached data is an error; otherwise the cached list keeps showing.
    isError: (watchlist.isError && !watchlist.data) || (stocks.isError && !stocks.data),
    retry: () => {
      if (watchlist.isError) void watchlist.refetch();
      if (stocks.isError) void stocks.refetch();
    },
  };
}

export function useMarketList(filter: MarketFilter) {
  const stocks = useStocks();
  return {
    rows: filterAndSort(stocks.data ?? [], filter),
    isLoading: stocks.isPending,
    isError: stocks.isError && !stocks.data,
    isRefreshing: stocks.isRefetching,
    refresh: () => void stocks.refetch(),
  };
}

export function useAppConfig(): AppConfig | undefined {
  const { api, store } = useSarwa();
  const live = useStore(store, (state) => state.appConfig);
  const { data } = useQuery({
    queryKey: queryKeys.appConfig,
    queryFn: ({ signal }) => api.getAppConfig({ signal }),
    staleTime: 60_000,
  });
  if (!live) return data;
  if (!data) return live;
  return live.updatedAt >= data.updatedAt ? live : data;
}
