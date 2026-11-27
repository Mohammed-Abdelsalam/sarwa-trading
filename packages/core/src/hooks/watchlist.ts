import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useCallback, useMemo, useSyncExternalStore } from 'react';

import { sortStocks, type SortOption } from '../markets';
import { useSarwa } from '../provider';
import { queryKeys } from './keys';
import { useAverageChange, useLiveSymbols } from './live';
import { useStocks } from './market';

export function usePendingRemoval(): string | null {
  const { removals } = useSarwa();
  return useSyncExternalStore(removals.subscribe, removals.getPending, removals.getPending);
}

// Hiding the pending symbol here keeps every star, row and average in agreement during the undo
// window, even if a refetch returns it before the delete is sent.
export function useWatchlist(): UseQueryResult<string[]> {
  const { api } = useSarwa();
  const pending = usePendingRemoval();
  const select = useCallback(
    (symbols: string[]) => (pending ? symbols.filter((s) => s !== pending) : symbols),
    [pending],
  );
  return useQuery({
    queryKey: queryKeys.watchlist,
    queryFn: async ({ signal }) => (await api.getWatchlist({ signal })).symbols,
    select,
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

interface ToggleVariables {
  symbol: string;
  watched: boolean;
}

export function useToggleWatchlist() {
  const { api, removals } = useSarwa();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationKey: TOGGLE_WATCHLIST_KEY,
    mutationFn: ({ symbol, watched }: ToggleVariables) =>
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

  return {
    ...mutation,
    // Starring a stock whose delete hasn't been sent yet just cancels the delete.
    mutate: (variables: ToggleVariables) => {
      if (!variables.watched && removals.getPending() === variables.symbol) removals.undo();
      else mutation.mutate(variables);
    },
  };
}

export function useWatchToggle(symbol: string): { watched: boolean; toggle: () => void } {
  const watched = useIsWatched(symbol);
  const { mutate } = useToggleWatchlist();
  return {
    watched,
    toggle: () => {
      mutate({ symbol, watched });
    },
  };
}

export function useUndoableRemove() {
  const { api, removals } = useSarwa();
  const queryClient = useQueryClient();
  const pending = usePendingRemoval();

  return {
    pending,
    // The commit captures the client and API, so it still runs after the screen unmounts.
    remove: (symbol: string) => {
      const commit = async () => {
        queryClient.setQueryData<string[]>(queryKeys.watchlist, (list) =>
          list?.filter((s) => s !== symbol),
        );
        // A failed delete is corrected by the refetch, which brings the row back.
        await api.removeFromWatchlist(symbol).catch(() => undefined);
        await queryClient.invalidateQueries({ queryKey: queryKeys.watchlist });
      };
      removals.schedule(symbol, () => void commit());
    },
    undo: removals.undo,
    dismiss: removals.flush,
  };
}

export function useWatchlistStocks({ sort = null }: { sort?: SortOption | null } = {}) {
  const watchlist = useWatchlist();
  const stocks = useStocks();
  const symbols = watchlist.data ?? [];
  const average = useAverageChange(symbols);
  useLiveSymbols(symbols);
  const bySymbol = new Map((stocks.data ?? []).map((stock) => [stock.symbol, stock]));
  // Keep the order the stocks were added in; skip symbols the admin has since disabled.
  const rows = symbols.flatMap((symbol) => bySymbol.get(symbol) ?? []);

  return {
    rows: sort ? sortStocks(rows, sort) : rows,
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
