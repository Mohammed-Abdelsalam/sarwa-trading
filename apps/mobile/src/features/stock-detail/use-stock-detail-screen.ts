import { useState } from 'react';

import { type Period } from '@sarwa/contracts';
import {
  resolvePeriod,
  useEnabledPeriods,
  useIsWatched,
  useLiveStatus,
  useStockDetail,
  useToggleWatchlist,
} from '@sarwa/core';

import { type ScrubPoint } from './use-price-chart';

export function useStockDetailScreen(symbol: string) {
  const { stock, quote, stats, notFound, isError, retry } = useStockDetail(symbol);
  const watched = useIsWatched(symbol);
  const { mutate: toggle } = useToggleWatchlist();
  const status = useLiveStatus();
  const enabledPeriods = useEnabledPeriods();
  const [period, setPeriod] = useState<Period>('1D');
  const [scrubbed, setScrubbed] = useState<ScrubPoint | null>(null);

  return {
    stock,
    quote,
    stats,
    status,
    watched,
    notFound,
    isError,
    chart: { period: resolvePeriod(enabledPeriods, period), enabledPeriods, scrubbed },
    actions: {
      toggleWatch: () => {
        toggle({ symbol, watched });
      },
      retry,
      setPeriod,
      scrub: setScrubbed,
    },
  };
}
