import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  type AdminStock,
  type AdminStocksResponse,
  type AuditQuery,
  type CreateStock,
  type UpdateStock,
  type UpdateUser,
} from '@sarwa/contracts';

import { adminKeys } from './keys';
import { useAdmin } from './provider';

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

export function useUpdateUser() {
  const { api } = useAdmin();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateUser }) => api.updateUser(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.users }),
  });
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
