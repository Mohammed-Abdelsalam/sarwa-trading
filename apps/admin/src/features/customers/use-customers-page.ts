import { type Route } from 'next';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { ApiError } from '@sarwa/core';
import {
  type CustomerFilters,
  customerFiltersFromParams,
  customerFiltersToParams,
  customersQuery,
  useAdminI18n,
  useCustomerKpis,
  useCustomers,
  useExportCustomers,
} from '@sarwa/core/admin';
import { downloadCsv } from '@sarwa/ui';

import { useAccess } from '../../components/common/access';
import { useToast } from '../../components/common/toasts';
import { setSearchParams, useSearchParamText } from '../../lib/search-params';
import { type CustomerActionKind } from '../customer-detail/customer-actions';
import { type CustomersView } from './customers-page';

const WEB_URL = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000';
const NO_FILTERS: CustomerFilters = { q: '', status: 'all', verified: false, hasOpenOrders: false };

const shareBps = (part: number, whole: number) =>
  whole > 0 ? Math.round((part * 10_000) / whole) : 0;

export const customerHref = (handle: string, action?: CustomerActionKind) =>
  `/customers/${encodeURIComponent(handle)}${action ? `?action=${action}` : ''}` as Route;

export function useCustomersPage(): CustomersView {
  const { isViewer, canEdit } = useAccess();
  const router = useRouter();
  const params = useSearchParams();
  const search = useSearchParamText(params, 'q');
  const filters = customerFiltersFromParams((key) => params.get(key));
  const customers = useCustomers(customersQuery(filters));
  const kpis = useCustomerKpis();
  const { t } = useAdminI18n();
  const toast = useToast();
  const exporter = useExportCustomers({
    save: (name, csv) => {
      downloadCsv(name, csv);
      toast(t.admin.customer.toasts.exported);
    },
  });
  const [linkCopied, setLinkCopied] = useState(false);
  const apply = (patch: Partial<CustomerFilters>) => {
    setSearchParams(customerFiltersToParams({ ...filters, ...patch }));
  };
  const failed = customers.isError && !customers.data;
  const error = customers.error instanceof ApiError ? customers.error : null;

  return {
    isViewer,
    canEdit,
    kpis: kpis.data
      ? {
          ...kpis.data,
          activeShareBps: shareBps(kpis.data.active24h, kpis.data.registered),
          suspendedShareBps: shareBps(kpis.data.suspended, kpis.data.registered),
        }
      : null,
    rows: customers.items,
    status: failed ? 'error' : customers.isPending ? 'loading' : 'ready',
    error: failed && error ? { status: error.status, requestId: error.requestId ?? '—' } : null,
    search: search.text,
    segment: filters.status,
    verified: filters.verified,
    hasOpenOrders: filters.hasOpenOrders,
    hasMore: customers.hasNextPage,
    isFetchingMore: customers.isFetchingNextPage,
    isExporting: exporter.isPending,
    linkCopied,
    now: customers.dataUpdatedAt,
    detailHref: (handle) => customerHref(handle),
    actions: {
      retry: () => void customers.refetch(),
      search: search.set,
      setSegment: (status) => {
        apply({ status });
      },
      toggleVerified: () => {
        apply({ verified: !filters.verified });
      },
      toggleOpenOrders: () => {
        apply({ hasOpenOrders: !filters.hasOpenOrders });
      },
      clearFilters: () => {
        search.clear(customerFiltersToParams(NO_FILTERS));
      },
      loadMore: () => void customers.fetchNextPage(),
      exportCsv: () => {
        if (canEdit) exporter.mutate(customersQuery(filters));
      },
      copyAppLink: () => {
        void navigator.clipboard
          .writeText(WEB_URL)
          .then(() => {
            setLinkCopied(true);
          })
          .catch(() => undefined);
      },
      // Row actions open the customer's page with that action's dialog, where the reason is asked.
      request: (handle, kind) => {
        router.push(customerHref(handle, kind));
      },
    },
  };
}
