import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import {
  type AdminStock,
  type AdminStocksResponse,
  type AuditQuery,
  type CreateStock,
  type CreateUser,
  type UpdateStock,
  type UpdateUser,
} from '@sarwa/contracts';

import { ApiError } from '../api';
import { adminKeys } from './keys';
import { useAdmin } from './provider';

export function isConflict(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409;
}

export function useAdminStocks() {
  const { api } = useAdmin();
  return useQuery({
    queryKey: adminKeys.stocks,
    queryFn: async ({ signal }) => (await api.listStocks({ signal })).items,
  });
}

export function useCreateStock() {
  const { api } = useAdmin();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateStock) => api.createStock(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.stocks }),
  });
}

type StockList = AdminStocksResponse['items'];

// Optimistic so the Enabled switch flips at once; a failure restores the previous list.
export function useUpdateStock() {
  const { api } = useAdmin();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ symbol, patch }: { symbol: string; patch: UpdateStock }) =>
      api.updateStock(symbol, patch),
    onMutate: async ({ symbol, patch }) => {
      await queryClient.cancelQueries({ queryKey: adminKeys.stocks });
      const previous = queryClient.getQueryData<StockList>(adminKeys.stocks);
      queryClient.setQueryData<StockList>(adminKeys.stocks, (items) =>
        items?.map((stock): AdminStock =>
          stock.symbol === symbol ? { ...stock, ...patch } : stock,
        ),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(adminKeys.stocks, context?.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: adminKeys.stocks }),
  });
}

export function useDeleteStock() {
  const { api } = useAdmin();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (symbol: string) => api.deleteStock(symbol),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.stocks }),
  });
}

export function useAdminUsers({ enabled = true }: { enabled?: boolean } = {}) {
  const { api } = useAdmin();
  return useQuery({
    queryKey: adminKeys.users,
    queryFn: async ({ signal }) => (await api.listUsers({ signal })).items,
    enabled,
  });
}

export function useCreateUser() {
  const { api } = useAdmin();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateUser) => api.createUser(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.users }),
  });
}

export function useUpdateUser() {
  const { api } = useAdmin();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateUser }) => api.updateUser(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.users }),
  });
}

export const SEARCH_DEBOUNCE_MS = 300;

// Search boxes query the server once typing pauses, not on every keystroke.
export function useDebouncedValue<T>(value: T, delayMs = SEARCH_DEBOUNCE_MS): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSettled(value);
    }, delayMs);
    return () => {
      clearTimeout(timer);
    };
  }, [value, delayMs]);
  return settled;
}

export const AUDIT_PAGE_SIZE = 25;

export function useAuditLog(query: AuditQuery) {
  const { api } = useAdmin();
  const full: AuditQuery = { pageSize: AUDIT_PAGE_SIZE, ...query };
  return useQuery({
    queryKey: adminKeys.audit(full),
    queryFn: ({ signal }) => api.audit(full, { signal }),
    placeholderData: keepPreviousData,
  });
}
