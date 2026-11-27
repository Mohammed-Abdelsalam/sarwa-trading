import { useState } from 'react';

import { type Period } from '@sarwa/contracts';
import {
  resolvePeriod,
  useEnabledPeriods,
  useI18n,
  useLiveStatus,
  useStockDetail,
  useWatchToggle,
} from '@sarwa/core';

export function useStockPreview(symbol: string) {
  const { t } = useI18n();
  const detail = useStockDetail(symbol);
  const { watched, toggle } = useWatchToggle(symbol);
  const status = useLiveStatus();
  const enabledPeriods = useEnabledPeriods();
  const [period, setPeriod] = useState<Period>('1D');

  return {
    ...detail,
    watched,
    live: status === 'live',
    sectorLabel: detail.stock ? t.sectors[detail.stock.sector] : undefined,
    period: resolvePeriod(enabledPeriods, period),
    enabledPeriods,
    setPeriod,
    toggleWatch: toggle,
  };
}
