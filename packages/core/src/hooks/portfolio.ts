import {
  keepPreviousData,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useMemo } from 'react';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

import {
  type Account,
  type EquityPeriod,
  type EquityResponse,
  type PortfolioPosition,
} from '@sarwa/contracts';
import { sellableMicros } from '@sarwa/domain';

import { useSarwa } from '../provider';
import { livePortfolio, toHold, toPosition } from '../trading';
import { useLiveSymbols } from './live';
import { useStocks } from './market';
import { usePrivateScope } from './session';

export function useAccount(): UseQueryResult<Account> {
  const { api } = useSarwa();
  const { keys, enabled } = usePrivateScope();
  return useQuery({
    queryKey: keys.account,
    queryFn: ({ signal }) => api.getAccount({ signal }),
    staleTime: 30_000,
    enabled,
  });
}

export function useEquityCurve(period: EquityPeriod): UseQueryResult<EquityResponse> {
  const { api } = useSarwa();
  const { keys, enabled } = usePrivateScope();
  return useQuery({
    queryKey: keys.equity(period),
    queryFn: ({ signal }) => api.getEquity(period, { signal }),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    enabled,
  });
}

export function usePortfolio() {
  const { api, store } = useSarwa();
  const queryClient = useQueryClient();
  const { keys, enabled } = usePrivateScope();
  const query = useQuery({
    queryKey: keys.portfolio,
    queryFn: ({ signal }) => api.getPortfolio({ signal }),
    staleTime: 30_000,
    enabled,
  });
  const stocks = useStocks();
  const books = query.data;
  const symbols = useMemo(() => books?.positions.map((p) => p.symbol) ?? [], [books]);
  useLiveSymbols(symbols);
  const live = useStore(
    store,
    useShallow((state) => symbols.map((symbol) => state.quotes[symbol])),
  );

  // Recomputed on every tick of a held symbol, so the P&L moves with the prices on screen.
  const summary = useMemo(() => {
    if (!books) return null;
    const snapshot = new Map((stocks.data ?? []).map((stock) => [stock.symbol, stock.quote]));
    return livePortfolio(books, (symbol) => live[symbols.indexOf(symbol)] ?? snapshot.get(symbol));
  }, [books, live, symbols, stocks.data]);

  const position = (symbol: string): PortfolioPosition | null =>
    books?.positions.find((p) => p.symbol === symbol) ?? null;

  return {
    books,
    summary,
    buyingPowerCents: summary?.buyingPowerCents ?? null,
    reservedCents: summary?.reservedCents ?? null,
    position,
    sellableMicros: (symbol: string) => {
      const held = position(symbol);
      return sellableMicros(held && toPosition(held), (books?.holds ?? []).map(toHold));
    },
    isLoading: enabled && query.isPending,
    isError: query.isError && !books,
    refresh: () => queryClient.invalidateQueries({ queryKey: keys.portfolio }),
  };
}
