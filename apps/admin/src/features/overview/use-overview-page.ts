import { useStocks } from '@sarwa/core';
import { STATS_REFRESH_MS, useAdminStats, useLiveTicker } from '@sarwa/core/admin';

const FALLBACK_TICKER = ['NVDA', 'AAPL', 'TSLA'];

// Short "maya@" handles keep the activity feed scannable; the audit log has the full address.
export function shortActor(email: string): string {
  const at = email.indexOf('@');
  return at > 0 ? email.slice(0, at + 1) : email;
}

export function useOverviewPage() {
  const stats = useAdminStats({ refetchInterval: STATS_REFRESH_MS });
  const top = stats.data?.topWatchlisted ?? [];
  const tickerSymbols =
    top.length >= 3 ? top.slice(0, 3).map((item) => item.symbol) : FALLBACK_TICKER;
  const ticker = useLiveTicker(tickerSymbols);
  const sectors = new Map((useStocks().data ?? []).map((stock) => [stock.symbol, stock.sector]));
  const maxCount = Math.max(1, ...top.map((item) => item.count));

  return {
    stats: stats.data,
    isLoading: stats.isPending,
    isError: stats.isError,
    isRefreshing: stats.isFetching,
    updatedAt: stats.dataUpdatedAt,
    bars: top.map((item) => ({
      ...item,
      sector: sectors.get(item.symbol) ?? ('tech' as const),
      weight: item.count / maxCount,
    })),
    activity: (stats.data?.recentActivity ?? []).map((entry) => ({
      ...entry,
      actor: shortActor(entry.actorEmail),
      at: Date.parse(entry.createdAt),
    })),
    ticker: ticker.rows,
    tickerLoading: ticker.isLoading,
    actions: {
      refresh: () => void stats.refetch(),
    },
  };
}

export type OverviewPageModel = ReturnType<typeof useOverviewPage>;
