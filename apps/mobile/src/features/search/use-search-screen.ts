import { router } from 'expo-router';
import { useDeferredValue, useState } from 'react';

import { DEFAULT_SORT, topMovers, useMarketList, useStockIndex, useStoredList } from '@sarwa/core';

const RECENT_KEY = 'sarwa.search.recent';
const MAX_RECENT = 6;

export function useSearchScreen(purpose?: string) {
  const [query, setQuery] = useState('');
  const searched = useDeferredValue(query.trim());
  const { rows } = useMarketList({ query: searched, sector: 'all', sort: DEFAULT_SORT });
  const { stocks, nameOf } = useStockIndex();
  const recent = useStoredList(RECENT_KEY, MAX_RECENT);
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
        else router.push({ pathname: '/stocks/[symbol]', params: { symbol } });
      },
    },
  };
}
