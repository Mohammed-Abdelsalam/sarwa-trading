import { type Period, SECTOR_LABELS } from '@sarwa/contracts';
import {
  type ChartType,
  parseChartType,
  parsePeriod,
  resolvePeriod,
  similarStocks,
  useEnabledPeriods,
  useLiveStatus,
  useStockDetail,
  useStocks,
  useWatchToggle,
} from '@sarwa/core';

import { replaceSearchParam, useSearchParam } from '../../lib/browser';

// Period and chart type live in the URL (?period=1M&type=candle) so a view can be shared (W-Detail).
export function useStockDetailPage(symbol: string) {
  const detail = useStockDetail(symbol);
  const { watched, toggle } = useWatchToggle(symbol);
  const status = useLiveStatus();
  const enabledPeriods = useEnabledPeriods();
  const stocks = useStocks();
  const period = resolvePeriod(enabledPeriods, parsePeriod(useSearchParam('period')));
  const type = parseChartType(useSearchParam('type'));

  return {
    ...detail,
    watched,
    live: status === 'live',
    sectorLabel: detail.stock ? SECTOR_LABELS[detail.stock.sector] : undefined,
    similar: similarStocks(stocks.data ?? [], symbol),
    chart: { period, type, enabledPeriods },
    actions: {
      toggleWatch: toggle,
      retry: detail.retry,
      setPeriod: (next: Period) => {
        replaceSearchParam('period', next === '1D' ? null : next);
      },
      setChartType: (next: ChartType) => {
        replaceSearchParam('type', next === 'area' ? null : next);
      },
    },
  };
}
