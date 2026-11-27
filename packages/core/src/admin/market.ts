import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useStore } from 'zustand';

import { type MarketCommand, type Sector, type UpdateAppConfig } from '@sarwa/contracts';
import { type Bps, changeBps, dollarsToTicks } from '@sarwa/domain';

import { useLiveSymbols } from '../hooks/live';
import { useStocks } from '../hooks/market';
import { useSarwa } from '../provider';
import { adminKeys } from './keys';
import { useAdmin } from './provider';

export const STATS_REFRESH_MS = 10_000;

// React Query pauses the interval while the tab is hidden, so polling only runs when someone looks.
export function useAdminStats({ refetchInterval }: { refetchInterval?: number } = {}) {
  const { api } = useAdmin();
  return useQuery({
    queryKey: adminKeys.stats,
    queryFn: ({ signal }) => api.stats({ signal }),
    refetchInterval,
    refetchIntervalInBackground: false,
  });
}

// The running server's build, e.g. "v1.2.0 · 3f9c2ab"; it only changes on a deploy.
export function useServerVersion(): string | null {
  const { api } = useAdmin();
  const { data } = useQuery({
    queryKey: adminKeys.health,
    queryFn: ({ signal }) => api.health({ signal }),
    staleTime: Infinity,
  });
  return data ? `v${data.version} · ${data.commit}` : null;
}

export function useMarketCommand() {
  const { api } = useAdmin();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (command: MarketCommand) => api.marketCommand(command),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.stats }),
  });
}

export function useAdminConfig() {
  const { api } = useAdmin();
  return useQuery({
    queryKey: adminKeys.config,
    queryFn: ({ signal }) => api.getConfig({ signal }),
  });
}

export function useUpdateConfig() {
  const { api } = useAdmin();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdateAppConfig) => api.updateConfig(patch),
    onSuccess: (config) => {
      queryClient.setQueryData(adminKeys.config, config);
    },
  });
}

export interface TickerRow {
  symbol: string;
  name: string;
  sector: Sector;
  price: number;
  changeBps: Bps;
  sparkline: readonly number[];
}

// Public stock list + live quotes from the /market socket, for the ticker previews.
export function useLiveTicker(symbols?: readonly string[]): {
  rows: TickerRow[];
  isLoading: boolean;
} {
  const { store } = useSarwa();
  const stocks = useStocks();
  const listed = stocks.data ?? [];
  const picked = symbols
    ? symbols.flatMap((symbol) => listed.filter((stock) => stock.symbol === symbol))
    : listed;
  useLiveSymbols(picked.map((stock) => stock.symbol));
  const quotes = useStore(store, (state) => state.quotes);

  return {
    isLoading: stocks.isPending,
    rows: picked.map((stock) => {
      const quote = quotes[stock.symbol] ?? stock.quote;
      return {
        symbol: stock.symbol,
        name: stock.name,
        sector: stock.sector,
        price: quote.price,
        changeBps: changeBps(dollarsToTicks(quote.prevClose), dollarsToTicks(quote.price)),
        sparkline: stock.sparkline,
      };
    }),
  };
}
