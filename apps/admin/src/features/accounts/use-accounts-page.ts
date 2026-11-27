import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { type AdminAccount, type AdminAccountsQuery, resetConfirmation } from '@sarwa/contracts';
import { POLICY } from '@sarwa/core';
import {
  isResetConfirmed,
  useAdminAccounts,
  useAdminSession,
  useResetAccount,
} from '@sarwa/core/admin';

import { oneOf, pageParam, setSearchParams, useSearchParamText } from '../../lib/search-params';

export type AccountSort = NonNullable<AdminAccountsQuery['sort']>;
export const ACCOUNTS_PAGE_SIZE = 25;
const SORTS: readonly AccountSort[] = ['allTime', 'equity', 'lastTrade'];

export function useAccountsPage() {
  const { canEdit } = useAdminSession();
  const params = useSearchParams();
  const search = useSearchParamText(params, 'q', { page: null });
  const sort = oneOf(params.get('sort'), SORTS, 'allTime');
  const page = pageParam(params.get('page'));
  const [viewing, setViewing] = useState<AdminAccount | null>(null);
  const [resetting, setResetting] = useState<AdminAccount | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [resetDone, setResetDone] = useState<string | null>(null);
  const q = search.value;
  const accounts = useAdminAccounts({
    q: q || undefined,
    sort,
    page,
    pageSize: ACCOUNTS_PAGE_SIZE,
  });
  const reset = useResetAccount();

  return {
    canEdit,
    search: search.text,
    query: q,
    sort,
    page,
    rows: accounts.data?.items ?? [],
    total: accounts.data?.total ?? 0,
    now: accounts.dataUpdatedAt,
    startingCashCents: POLICY.startingCashCents,
    isLoading: accounts.isPending,
    isError: accounts.isError,
    viewing,
    resetDone,
    reset: {
      account: resetting,
      text: confirmText,
      phrase: resetting ? resetConfirmation(resetting.handle) : '',
      confirmed: resetting ? isResetConfirmed(resetting.handle, confirmText) : false,
      isSaving: reset.isPending,
      failed: reset.isError,
    },
    actions: {
      retry: () => void accounts.refetch(),
      search: search.set,
      sortBy: (key: AccountSort) => {
        setSearchParams({ sort: key === 'allTime' ? null : key, page: null });
      },
      setPage: (next: number) => {
        setSearchParams({ page: next > 1 ? next : null });
      },
      view: setViewing,
      closeView: () => {
        setViewing(null);
      },
      openReset: (account: AdminAccount) => {
        reset.reset();
        setConfirmText('');
        setResetting(account);
      },
      closeReset: () => {
        setResetting(null);
      },
      setConfirmText,
      confirmReset: () => {
        if (!resetting || !isResetConfirmed(resetting.handle, confirmText)) return;
        reset.mutate(
          { id: resetting.id, confirm: confirmText },
          {
            onSuccess: () => {
              setResetDone(resetting.handle);
              setResetting(null);
              setViewing(null);
            },
          },
        );
      },
    },
  };
}

export type AccountsPageModel = ReturnType<typeof useAccountsPage>;
