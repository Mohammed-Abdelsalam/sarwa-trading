import { useState } from 'react';

import { type Period, SECTOR_LABELS } from '@sarwa/contracts';
import {
  resolvePeriod,
  useEnabledPeriods,
  useLiveStatus,
  useStockDetail,
  useWatchToggle,
} from '@sarwa/core';

export function useStockPreview(symbol: string) {
  const detail = useStockDetail(symbol);
  const { watched, toggle } = useWatchToggle(symbol);
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
    toggleWatch: toggle,
  };
}
