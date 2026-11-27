import * as Linking from 'expo-linking';
import { useState } from 'react';
import { Platform, Share } from 'react-native';

import { PERIODS, SECTOR_LABELS } from '@sarwa/contracts';
import {
  CHART_TYPES,
  resolvePeriod,
  type ScrubPoint,
  shareStockMessage,
  similarStocks,
  useEnabledPeriods,
  useLiveStatus,
  useLiveSymbols,
  usePreference,
  useRefreshStock,
  useStockDetail,
  useStocks,
  useWatchToggle,
} from '@sarwa/core';

const CHART_TYPE_VALUES = CHART_TYPES.map((option) => option.value);

// Mobile remembers the last period and chart type; the web keeps them in the shareable URL instead.
export function useStockDetailScreen(symbol: string) {
  const { stock, quote, stats, week52, notFound, isError, retry } = useStockDetail(symbol);
  const { watched, toggle } = useWatchToggle(symbol);
  const status = useLiveStatus();
  const enabledPeriods = useEnabledPeriods();
  const period = usePreference('sarwa.chart.period', PERIODS, '1D');
  const type = usePreference('sarwa.chart.type', CHART_TYPE_VALUES, 'area');
  const { refresh, isRefreshing } = useRefreshStock(symbol);
  const [scrubbed, setScrubbed] = useState<ScrubPoint | null>(null);
  const similar = similarStocks(useStocks().data ?? [], symbol);
  useLiveSymbols(similar.map((s) => s.symbol));

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
    sectorLabel: stock ? SECTOR_LABELS[stock.sector] : undefined,
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
        const message = shareStockMessage({ symbol, name: stock.name, quote });
        const url = Linking.createURL(`/stock/${symbol}`);
        // Android shares only the message, so the link rides inside it there.
        void Share.share(
          Platform.OS === 'ios' ? { message, url } : { message: `${message}\n${url}` },
        );
      },
    },
  };
}
