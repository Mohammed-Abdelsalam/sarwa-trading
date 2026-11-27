import { type Period, PERIODS, SECTOR_LABELS } from '@sarwa/contracts';
import {
  resolvePeriod,
  similarStocks,
  useEnabledPeriods,
  useIsWatched,
  useLiveStatus,
  useStockDetail,
  useStocks,
  useToggleWatchlist,
} from '@sarwa/core';

import { replaceSearchParam, useSearchParam } from '../../lib/browser';
import { type ChartType } from './use-price-chart';

function parsePeriod(value: string | null): Period {
  return PERIODS.find((p) => p === value) ?? '1D';
}

// Period and chart type live in the URL (?period=1M&type=candle) so a view can be shared (W-Detail).
export function useStockDetailPage(symbol: string) {
  const detail = useStockDetail(symbol);
  const watched = useIsWatched(symbol);
  const { mutate: toggle } = useToggleWatchlist();
  const status = useLiveStatus();
  const enabledPeriods = useEnabledPeriods();
  const stocks = useStocks();
  const periodParam = useSearchParam('period');
  const type: ChartType = useSearchParam('type') === 'candle' ? 'candle' : 'area';

  return {
    ...detail,
    watched,
    live: status === 'live',
    sectorLabel: detail.stock ? SECTOR_LABELS[detail.stock.sector] : undefined,
    similar: similarStocks(stocks.data ?? [], symbol),
    chart: {
      period: resolvePeriod(enabledPeriods, parsePeriod(periodParam)),
      type,
      enabledPeriods,
    },
    actions: {
      toggleWatch: () => {
        toggle({ symbol, watched });
      },
      retry: detail.retry,
      setPeriod: (period: Period) => {
        replaceSearchParam('period', period === '1D' ? null : period);
      },
      setChartType: (type: ChartType) => {
        replaceSearchParam('type', type === 'area' ? null : type);
      },
    },
  };
}
