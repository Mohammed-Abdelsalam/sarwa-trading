import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { type Halt, type TradingStatus } from '@sarwa/contracts';

import { useSarwa } from '../provider';
import { queryKeys } from './keys';

export function useTradingStatus(): UseQueryResult<TradingStatus> {
  const { api } = useSarwa();
  return useQuery({
    queryKey: queryKeys.tradingStatus,
    queryFn: ({ signal }) => api.getTradingStatus({ signal }),
    staleTime: 60_000,
  });
}

export function useHalt(symbol: string): Halt | null {
  const { data } = useTradingStatus();
  return data?.halts.find((halt) => halt.symbol === symbol) ?? null;
}

export function useIsHalted(symbol: string): boolean {
  return useHalt(symbol) !== null;
}
