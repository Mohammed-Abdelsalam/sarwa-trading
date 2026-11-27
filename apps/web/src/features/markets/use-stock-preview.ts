import { useState } from 'react';

import { type Period, SECTOR_LABELS } from '@sarwa/contracts';
import {
  resolvePeriod,
  useEnabledPeriods,
  useIsWatched,
  useLiveStatus,
  useStockDetail,
  useToggleWatchlist,
} from '@sarwa/core';

export function useStockPreview(symbol: string) {
  const detail = useStockDetail(symbol);
  const watched = useIsWatched(symbol);
  const { mutate: toggle } = useToggleWatchlist();
  const status = useLiveStatus();
  const enabledPeriods = useEnabledPeriods();
  const [period, setPeriod] = useState<Period>('1D');

  return {
    ...detail,
    watched,
    live: status === 'live',
    sectorLabel: detail.stock ? SECTOR_LABELS[detail.stock.sector] : undefined,
    period: resolvePeriod(enabledPeriods, period),
    enabledPeriods,
    setPeriod,
    toggleWatch: () => {
      toggle({ symbol, watched });
    },
  };
}
