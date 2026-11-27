import { useState } from 'react';

import { type AdminAccount, type AdminAccountsQuery, resetConfirmation } from '@sarwa/contracts';
import { POLICY } from '@sarwa/core';
import {
  isResetConfirmed,
  useAdminAccounts,
  useAdminSession,
  useResetAccount,
} from '@sarwa/core/admin';

export type AccountSort = NonNullable<AdminAccountsQuery['sort']>;
export const ACCOUNTS_PAGE_SIZE = 25;

export function useAccountsPage() {
  const { canEdit } = useAdminSession();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<AccountSort>('allTime');
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState<AdminAccount | null>(null);
  const [resetting, setResetting] = useState<AdminAccount | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [resetDone, setResetDone] = useState<string | null>(null);
  const q = search.trim();
  const accounts = useAdminAccounts({
    q: q || undefined,
    sort,
    page,
    pageSize: ACCOUNTS_PAGE_SIZE,
  });
  const reset = useResetAccount();

  return {
    canEdit,
    search,
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
      search: (value: string) => {
        setSearch(value);
        setPage(1);
      },
      sortBy: (key: AccountSort) => {
        setSort(key);
        setPage(1);
      },
      setPage,
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
