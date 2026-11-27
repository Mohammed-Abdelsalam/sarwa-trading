import { useState } from 'react';
import { Platform, Share } from 'react-native';

import { PERIODS } from '@sarwa/contracts';
import {
  CHART_TYPES,
  micros,
  resolvePeriod,
  type ScrubPoint,
  shareStockMessage,
  similarStocks,
  useEnabledPeriods,
  useLiveStatus,
  useLiveSymbols,
  usePortfolio,
  usePreference,
  useRefreshStock,
  useStockDetail,
  useStocks,
  useWatchToggle,
} from '@sarwa/core';

import { useCopy } from '../../lib/i18n';
import { stockWebUrl } from '../../lib/navigation';

// Mobile remembers the last period and chart type; the web keeps them in the shareable URL instead.
export function useStockDetailScreen(symbol: string) {
  const { stock, quote, stats, week52, notFound, isError, retry } = useStockDetail(symbol);
  const { watched, toggle } = useWatchToggle(symbol);
  const status = useLiveStatus();
  const enabledPeriods = useEnabledPeriods();
  const period = usePreference('sarwa.chart.period', PERIODS, '1D');
  const type = usePreference('sarwa.chart.type', CHART_TYPES, 'area');
  const { refresh, isRefreshing } = useRefreshStock(symbol);
  const [scrubbed, setScrubbed] = useState<ScrubPoint | null>(null);
  const similar = similarStocks(useStocks().data ?? [], symbol);
  useLiveSymbols(similar.map((s) => s.symbol));
  const copy = useCopy();
  const { t } = copy;

  return {
    stock,
    quote,
    stats,
    week52,
    status,
    watched,
    notFound,
    isError,
    isRefreshing,
    sectorLabel: stock ? t.sectors[stock.sector] : undefined,
    similar,
    chart: {
      period: resolvePeriod(enabledPeriods, period.value),
      type: type.value,
      isLoaded: period.isLoaded && type.isLoaded,
      enabledPeriods,
      scrubbed,
    },
    actions: {
      toggleWatch: toggle,
      retry,
      refresh,
      setPeriod: period.setValue,
      setChartType: type.setValue,
      scrub: setScrubbed,
      share: () => {
        if (!stock || !quote) return;
        const message = shareStockMessage(copy, { symbol, name: stock.name, quote });
        const url = stockWebUrl(symbol);
        // Android shares only the message, so the link rides inside it there.
        void Share.share(
          Platform.OS === 'ios' ? { message, url } : { message: `${message}\n${url}` },
        );
      },
    },
  };
}

// Its own hook so a tick on another held stock re-renders only the trade bar, not the whole screen.
export function useSellLabel(symbol: string): string {
  const { t, f } = useCopy();
  const held = usePortfolio().position(symbol);
  return held ? t.ticket.sellHeld({ shares: f.shares(micros(held.qtyMicros)) }) : t.common.sell;
}
