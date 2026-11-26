import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useSarwa } from '../provider';
import { queryKeys } from './keys';
import { useAverageChange, useLiveSymbols } from './live';
import { useStocks } from './market';

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

export function useWatchlistStocks() {
  const watchlist = useWatchlist();
  const stocks = useStocks();
  const symbols = watchlist.data ?? [];
  const average = useAverageChange(symbols);
  useLiveSymbols(symbols);
  const bySymbol = new Map((stocks.data ?? []).map((stock) => [stock.symbol, stock]));

  return {
    // Keep the order the stocks were added in; skip symbols the admin has since disabled.
    rows: symbols.flatMap((symbol) => bySymbol.get(symbol) ?? []),
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
