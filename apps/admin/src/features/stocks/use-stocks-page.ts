import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import {
  type AdminStock,
  ErrorCode,
  EXCHANGES,
  type Exchange,
  type Sector,
  SECTORS,
} from '@sarwa/contracts';
import {
  EMPTY_STOCK_DRAFT,
  isApiError,
  type StockDraft,
  type StockErrors,
  stockToDraft,
  useAdminStocks,
  useCreateStock,
  useDeleteStock,
  useUpdateStock,
  validateStockDraft,
} from '@sarwa/core/admin';

import { useAccess } from '../../components/common/access';
import { oneOf, setSearchParams, useSearchParamText } from '../../lib/search-params';

const SORT_KEYS = ['symbol', 'name', 'sector', 'exchange', 'basePrice', 'volatility'] as const;
export type StockSortKey = (typeof SORT_KEYS)[number];
export interface StockSort {
  key: StockSortKey;
  direction: 'ascending' | 'descending';
}

function sortStocks(stocks: readonly AdminStock[], { key, direction }: StockSort): AdminStock[] {
  const sign = direction === 'ascending' ? 1 : -1;
  return [...stocks].sort((a, b) => {
    const left = a[key];
    const right = b[key];
    const order =
      typeof left === 'number' && typeof right === 'number'
        ? left - right
        : String(left).localeCompare(String(right));
    return order * sign;
  });
}

function useStockDialog(existing: readonly string[]) {
  const create = useCreateStock();
  const update = useUpdateStock();
  const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<StockDraft>(EMPTY_STOCK_DRAFT);
  const [submitted, setSubmitted] = useState(false);
  const [taken, setTaken] = useState(false);
  const result = validateStockDraft(draft, { existing, editing: editing !== null });
  const errors: StockErrors = submitted
    ? { ...result.errors, ...(taken && !result.errors.symbol ? { symbol: 'symbolTaken' } : {}) }
    : {};

  return {
    open,
    editing,
    draft,
    errors,
    errorCount: Object.keys(errors).length,
    isSaving: create.isPending || update.isPending,
    failed: (create.isError && !taken) || update.isError,
    actions: {
      openCreate: () => {
        create.reset();
        setEditing(null);
        setDraft(EMPTY_STOCK_DRAFT);
        setSubmitted(false);
        setTaken(false);
        setOpen(true);
      },
      openEdit: (stock: AdminStock) => {
        update.reset();
        setEditing(stock.symbol);
        setDraft(stockToDraft(stock));
        setSubmitted(false);
        setOpen(true);
      },
      close: () => {
        setOpen(false);
      },
      set: <K extends keyof StockDraft>(key: K, value: StockDraft[K]) => {
        if (key === 'symbol') setTaken(false);
        setDraft((current) => ({ ...current, [key]: value }));
      },
      submit: () => {
        setSubmitted(true);
        const close = {
          onSuccess: () => {
            setOpen(false);
          },
        };
        if (editing !== null && result.update) {
          update.mutate({ symbol: editing, patch: result.update }, close);
        } else if (editing === null && result.create) {
          create.mutate(result.create, {
            ...close,
            onError: (error) => {
              if (isApiError(error, ErrorCode.Conflict)) setTaken(true);
            },
          });
        }
      },
    },
  };
}

export function useStocksPage() {
  const { canEdit, isViewer } = useAccess();
  const stocks = useAdminStocks();
  const toggle = useUpdateStock();
  const remove = useDeleteStock();
  const params = useSearchParams();
  const search = useSearchParamText(params, 'q');
  const sector = oneOf<Sector | 'all'>(params.get('sector'), SECTORS, 'all');
  const exchange = oneOf<Exchange | 'all'>(params.get('exchange'), EXCHANGES, 'all');
  const sort: StockSort = {
    key: oneOf(params.get('sort'), SORT_KEYS, 'symbol'),
    direction: params.get('dir') === 'desc' ? 'descending' : 'ascending',
  };
  const [deleting, setDeleting] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const all = stocks.data ?? [];
  const dialog = useStockDialog(all.map((stock) => stock.symbol));
  const q = search.text.trim().toLowerCase();
  const rows = sortStocks(
    all.filter(
      (stock) =>
        (sector === 'all' || stock.sector === sector) &&
        (exchange === 'all' || stock.exchange === exchange) &&
        (!q || stock.symbol.toLowerCase().includes(q) || stock.name.toLowerCase().includes(q)),
    ),
    sort,
  );

  return {
    canEdit,
    isViewer,
    rows,
    total: all.length,
    enabledCount: all.filter((stock) => stock.isEnabled).length,
    search: search.text,
    sector,
    exchange,
    sort,
    isLoading: stocks.isPending,
    isError: stocks.isError,
    toggleFailed: toggle.isError,
    dialog,
    deletion: {
      symbol: deleting,
      conflict,
      isDeleting: remove.isPending,
      failed: remove.isError && !conflict,
    },
    actions: {
      retry: () => void stocks.refetch(),
      search: search.set,
      clearSearch: () => {
        search.clear();
      },
      setSector: (next: Sector | 'all') => {
        setSearchParams({ sector: next === 'all' ? null : next });
      },
      setExchange: (next: Exchange | 'all') => {
        setSearchParams({ exchange: next === 'all' ? null : next });
      },
      sortBy: (key: StockSortKey) => {
        const descending = sort.key === key && sort.direction === 'ascending';
        setSearchParams({ sort: key === 'symbol' ? null : key, dir: descending ? 'desc' : null });
      },
      setEnabled: (symbol: string, isEnabled: boolean) => {
        toggle.mutate({ symbol, patch: { isEnabled } });
      },
      askDelete: (symbol: string) => {
        remove.reset();
        setConflict(false);
        setDeleting(symbol);
      },
      closeDelete: () => {
        setDeleting(null);
      },
      confirmDelete: () => {
        if (!deleting) return;
        remove.mutate(deleting, {
          onSuccess: () => {
            setDeleting(null);
          },
          onError: (error) => {
            if (isApiError(error, ErrorCode.Conflict)) setConflict(true);
          },
        });
      },
      disableInstead: () => {
        if (!deleting) return;
        toggle.mutate({ symbol: deleting, patch: { isEnabled: false } });
        setDeleting(null);
      },
    },
  };
}

export type StocksPageModel = ReturnType<typeof useStocksPage>;
export type StockDialogModel = StocksPageModel['dialog'];
