import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useDeferredValue, useState } from 'react';

import { DEFAULT_SORT, queryKeys, useMarketList, useSarwa } from '@sarwa/core';

import { useStockIndex } from '../../lib/sectors';
import { topMovers } from '../home/use-home-screen';

const RECENT_KEY = 'sarwa.search.recent';
const MAX_RECENT = 6;

export function addRecent(list: readonly string[], symbol: string): string[] {
  return [symbol, ...list.filter((item) => item !== symbol)].slice(0, MAX_RECENT);
}

export function parseRecent(raw: string | null): string[] {
  try {
    const value: unknown = JSON.parse(raw ?? '[]');
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

// Recent searches ride the same storage and cache key family as the other device preferences.
function useRecentSearches() {
  const { storage } = useSarwa();
  const queryClient = useQueryClient();
  const key = queryKeys.preference(RECENT_KEY);
  const query = useQuery({
    queryKey: key,
    queryFn: () => storage.getItem(RECENT_KEY),
    staleTime: Infinity,
    retry: false,
  });
  const save = (list: string[]) => {
    const raw = JSON.stringify(list);
    queryClient.setQueryData(key, raw);
    storage.setItem(RECENT_KEY, raw).catch(() => undefined);
  };
  const list = parseRecent(query.data ?? null);
  return {
    list,
    add: (symbol: string) => {
      save(addRecent(list, symbol));
    },
    clear: () => {
      save([]);
    },
  };
}

export function useSearchScreen(purpose?: string) {
  const [query, setQuery] = useState('');
  const searched = useDeferredValue(query.trim());
  const { rows } = useMarketList({ query: searched, sector: 'all', sort: DEFAULT_SORT });
  const { stocks, nameOf } = useStockIndex();
  const recent = useRecentSearches();
  const forAlert = purpose === 'alert';

  return {
    query,
    searched,
    results: searched ? rows : [],
    recent: recent.list.map((symbol) => ({ symbol, name: nameOf(symbol) ?? '' })),
    trending: topMovers(stocks, 'gainers'),
    actions: {
      setQuery,
      clearRecent: recent.clear,
      select: (symbol: string) => {
        recent.add(symbol);
        if (forAlert) router.replace({ pathname: '/alerts', params: { symbol } });
        else router.push({ pathname: '/stock/[symbol]', params: { symbol } });
      },
    },
  };
}
