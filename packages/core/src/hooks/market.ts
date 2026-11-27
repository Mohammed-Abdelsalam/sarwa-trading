import {
  keepPreviousData,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useState } from 'react';

import {
  type Candle,
  type Period,
  type StockDetailResponse,
  type StockWithQuote,
} from '@sarwa/contracts';

import { isNotFound } from '../api';
import { axisCandles, chartBaseline, describeChart, periodChange, withLiveQuote } from '../chart';
import { filterAndSort, keyStats, type MarketFilter, rangePosition } from '../markets';
import { useSarwa } from '../provider';
import { useI18n } from './i18n';
import { queryKeys } from './keys';
import { useLiveSymbols, useQuote } from './live';

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

export type LoadState = 'loading' | 'error' | 'ready';

export function useChartSeries(symbol: string, period: Period) {
  const i18n = useI18n();
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
    summary: describeChart(i18n, symbol, period, candles, baseline),
    periodChange: periodChange(candles, baseline),
    state,
    retry: () => void query.refetch(),
  };
}

export function useStockDetail(symbol: string) {
  const i18n = useI18n();
  const detail = useStock(symbol);
  const liveQuote = useQuote(symbol);
  useLiveSymbols([symbol]);

  const quote = liveQuote ?? detail.data?.quote;
  const notFound = isNotFound(detail.error);

  return {
    stock: detail.data?.stock,
    quote,
    stats: detail.data && quote ? keyStats(i18n, detail.data, quote) : null,
    week52:
      detail.data && quote
        ? {
            low: detail.data.stats.week52Low,
            high: detail.data.stats.week52High,
            position: rangePosition(
              quote.price,
              detail.data.stats.week52Low,
              detail.data.stats.week52High,
            ),
          }
        : null,
    notFound,
    isError: detail.isError && !detail.data && !notFound,
    retry: () => void detail.refetch(),
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

// The stock key prefixes its candles, so this refreshes the detail and its charts, never the list.
// Local state rather than isFetching, so period switches and background refetches show no spinner.
export function useRefreshStock(symbol: string) {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  return {
    isRefreshing,
    refresh: async () => {
      setIsRefreshing(true);
      try {
        await queryClient.invalidateQueries({ queryKey: queryKeys.stock(symbol) });
      } finally {
        setIsRefreshing(false);
      }
    },
  };
}
