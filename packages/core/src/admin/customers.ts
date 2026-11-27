import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import {
  type AcceptInviteRequest,
  type CreateInviteRequest,
  type CustomerActionResponse,
  type CustomerPosition,
  CustomerStatusFilterSchema,
  type CustomerStatusFilter,
  type CustomersQuery,
} from '@sarwa/contracts';
import { averageCostTicks, cents, changeBps, micros } from '@sarwa/domain';

import { type AdminApi } from './api';
import { adminKeys } from './keys';
import { orderNotionalCents } from './orders';
import { useAdmin } from './provider';

export const CUSTOMERS_PAGE_SIZE = 50;

// The list filters as they live in the URL: defaults are left out, so a clean list has no query.
export interface CustomerFilters {
  q: string;
  status: CustomerStatusFilter;
  verified: boolean;
  hasOpenOrders: boolean;
}

export function customerFiltersFromParams(get: (key: string) => string | null): CustomerFilters {
  const status = CustomerStatusFilterSchema.safeParse(get('status'));
  return {
    q: get('q')?.trim() ?? '',
    status: status.success ? status.data : 'all',
    verified: get('verified') === '1',
    hasOpenOrders: get('open') === '1',
  };
}

// For setSearchParams: null removes a key.
export function customerFiltersToParams(filters: CustomerFilters): Record<string, string | null> {
  return {
    q: filters.q || null,
    status: filters.status === 'all' ? null : filters.status,
    verified: filters.verified ? '1' : null,
    open: filters.hasOpenOrders ? '1' : null,
  };
}

export function customersQuery(filters: CustomerFilters): CustomersQuery {
  return {
    q: filters.q || undefined,
    status: filters.status,
    verified: filters.verified || undefined,
    hasOpenOrders: filters.hasOpenOrders || undefined,
    limit: CUSTOMERS_PAGE_SIZE,
  };
}

// The rows of every page loaded so far.
function pageItems<Item>(data: InfiniteData<{ items: Item[] }> | undefined) {
  return data?.pages.flatMap((page) => page.items) ?? [];
}

const nextCursor = (page: { nextCursor: string | null }) => page.nextCursor ?? undefined;

// Server-side cursor pages for the virtualized table.
export function useCustomers(query: CustomersQuery) {
  const { api } = useAdmin();
  const result = useInfiniteQuery({
    queryKey: adminKeys.customers(query),
    queryFn: ({ signal, pageParam }) => api.customers({ ...query, cursor: pageParam }, { signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
  });
  return {
    ...result,
    items: pageItems(result.data),
    total: result.data?.pages[0]?.total ?? 0,
  };
}

export function useCustomerKpis() {
  const { api } = useAdmin();
  return useQuery({
    queryKey: adminKeys.customerKpis,
    queryFn: ({ signal }) => api.customerKpis({ signal }),
  });
}

// A missing handle fails with isApiError(error, ErrorCode.NotFound).
export function useCustomer(handle: string) {
  const { api } = useAdmin();
  return useQuery({
    queryKey: adminKeys.customer(handle),
    queryFn: ({ signal }) => api.customer(handle, { signal }),
  });
}

// Avg cost = basis ÷ shares; the return compares the market value with the basis.
export function customerPositionRow(position: CustomerPosition) {
  const basis = cents(position.costBasisCents);
  const value = cents(position.marketValueCents);
  return {
    ...position,
    avgCostTicks: averageCostTicks({
      qtyMicros: micros(position.qtyMicros),
      costBasisCents: basis,
    }),
    returnCents: cents(value - basis),
    returnBps: changeBps(basis, value),
  };
}

export function useCustomerOrders(handle: string) {
  const { api } = useAdmin();
  const result = useInfiniteQuery({
    queryKey: adminKeys.customerOrders(handle),
    queryFn: ({ signal, pageParam }) =>
      api.customerOrders(handle, { cursor: pageParam }, { signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
  });
  return {
    ...result,
    items: pageItems(result.data).map((order) => ({
      ...order,
      notionalCents: orderNotionalCents(order),
    })),
  };
}

export function useCustomerActivity(handle: string) {
  const { api } = useAdmin();
  const result = useInfiniteQuery({
    queryKey: adminKeys.customerActivity(handle),
    queryFn: ({ signal, pageParam }) =>
      api.customerActivity(handle, { cursor: pageParam }, { signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
  });
  return { ...result, items: pageItems(result.data) };
}

export function useCustomerSessions(handle: string) {
  const { api } = useAdmin();
  return useQuery({
    queryKey: adminKeys.customerSessions(handle),
    queryFn: ({ signal }) => api.customerSessions(handle, { signal }),
  });
}

// ADMIN only and audited: the full IPs for this customer's sessions, by session id.
export function useRevealCustomer(handle: string) {
  const { api } = useAdmin();
  const mutation = useMutation({ mutationFn: () => api.revealCustomer(handle) });
  return {
    ...mutation,
    reveal: () => {
      mutation.mutate();
    },
    ips: new Map(mutation.data?.items.map((item) => [item.sessionId, item.ip]) ?? []),
  };
}

// ADMIN only and audited: the CSV for the current filters, handed to the app to save under a
// base name (downloadCsv from @sarwa/ui adds the date and extension).
export function useExportCustomers({ save }: { save: (name: string, csv: string) => void }) {
  const { api } = useAdmin();
  return useMutation({
    mutationFn: (query: CustomersQuery) => api.exportCustomers(query),
    onSuccess: (csv) => {
      save('customers', csv);
    },
  });
}

// Every action changes the row, the KPIs, the detail and its sessions: the whole prefix refetches.
function useCustomerAction<Body>(
  send: (api: AdminApi, handle: string, body: Body) => Promise<CustomerActionResponse>,
) {
  const { api } = useAdmin();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ handle, body }: { handle: string; body: Body }) => send(api, handle, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.customersAll }),
  });
}

type ActionBody<Name extends keyof AdminApi> = AdminApi[Name] extends (
  handle: string,
  body: infer Body,
) => Promise<CustomerActionResponse>
  ? Body
  : never;

export const useSuspendCustomer = () =>
  useCustomerAction((api, handle, body: ActionBody<'suspendCustomer'>) =>
    api.suspendCustomer(handle, body),
  );
export const useReactivateCustomer = () =>
  useCustomerAction((api, handle, body: ActionBody<'reactivateCustomer'>) =>
    api.reactivateCustomer(handle, body),
  );
export const useSignOutCustomer = () =>
  useCustomerAction((api, handle, body: ActionBody<'signOutCustomer'>) =>
    api.signOutCustomer(handle, body),
  );
export const useSendCustomerReset = () =>
  useCustomerAction((api, handle, body: ActionBody<'sendCustomerReset'>) =>
    api.sendCustomerReset(handle, body),
  );
export const useResetCustomerAccount = () =>
  useCustomerAction((api, handle, body: ActionBody<'resetCustomerAccount'>) =>
    api.resetCustomerAccount(handle, body),
  );

export function useInvites({ enabled = true }: { enabled?: boolean } = {}) {
  const { api } = useAdmin();
  return useQuery({
    queryKey: adminKeys.invites,
    queryFn: ({ signal }) => api.invites({ signal }),
    enabled,
  });
}

export function useCreateInvite() {
  const { api } = useAdmin();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateInviteRequest) => api.createInvite(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.invites }),
  });
}

export function useResendInvite() {
  const { api } = useAdmin();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.resendInvite(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.invites }),
  });
}

export function useRevokeInvite() {
  const { api } = useAdmin();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.revokeInvite(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.invites }),
  });
}

// The public accept page: who is invited, then joining signs the new admin in.
export function useInviteInfo(token: string) {
  const { api } = useAdmin();
  return useQuery({
    queryKey: adminKeys.invite(token),
    queryFn: ({ signal }) => api.inviteInfo(token, { signal }),
    retry: false,
  });
}

export function useAcceptInvite({ onSuccess }: { onSuccess?: () => void } = {}) {
  const { api } = useAdmin();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AcceptInviteRequest) => api.acceptInvite(body),
    onSuccess: (user) => {
      queryClient.setQueryData(adminKeys.session, user);
      onSuccess?.();
    },
  });
}
