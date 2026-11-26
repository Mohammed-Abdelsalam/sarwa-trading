import { useState } from 'react';

import { type Candle, type Period, PERIODS } from '@sarwa/contracts';
import {
  keyStats,
  useAppConfig,
  useIsWatched,
  useLiveStatus,
  useLiveSymbols,
  useQuote,
  useStock,
  useToggleWatchlist,
} from '@sarwa/core';

export function useStockDetailScreen(symbol: string) {
  const detail = useStock(symbol);
  const liveQuote = useQuote(symbol);
  const watched = useIsWatched(symbol);
  const { mutate: toggle } = useToggleWatchlist();
  const status = useLiveStatus();
  const enabledPeriods = useAppConfig()?.enabledPeriods ?? PERIODS;
  const [period, setPeriod] = useState<Period>('1D');
  const [scrubbed, setScrubbed] = useState<Candle | null>(null);
  useLiveSymbols([symbol]);

  const quote = liveQuote ?? detail.data?.quote;

  return {
    stock: detail.data?.stock,
    quote,
    stats: detail.data && quote ? keyStats(detail.data, quote) : null,
    status,
    watched,
    isError: detail.isError && !detail.data,
    chart: {
      // The admin can disable the selected period while the screen is open.
      period: enabledPeriods.includes(period) ? period : (enabledPeriods.at(0) ?? '1D'),
      enabledPeriods,
      scrubbed,
    },
    actions: {
      toggleWatch: () => {
        toggle({ symbol, watched });
      },
      retry: () => void detail.refetch(),
      setPeriod,
      scrub: setScrubbed,
    },
  };
}
