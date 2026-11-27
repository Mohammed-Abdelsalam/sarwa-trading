import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import {
  AUTH_TTL_MS,
  type CustomerActionResponse,
  type CustomerDetail,
  ErrorCode,
  resetConfirmation,
  type SuspensionCategory,
} from '@sarwa/contracts';
import {
  ADMIN_REASON_LENGTH,
  POLICY,
  SUSPENSION_CATEGORIES,
  ticksToDollars,
  useStockIndex,
} from '@sarwa/core';
import {
  auditPreview,
  customerPositionRow,
  dollarsToCents,
  isApiError,
  isResetConfirmed,
  useAdminI18n,
  useCustomer,
  useCustomerActivity,
  useCustomerOrders,
  useCustomerSessions,
  useReactivateCustomer,
  useResetCustomerAccount,
  useRevealCustomer,
  useSendCustomerReset,
  useSignOutCustomer,
  useSuspendCustomer,
} from '@sarwa/core/admin';

import { useAccess } from '../../components/common/access';
import { useToast } from '../../components/common/toasts';
import { oneOf, setSearchParams } from '../../lib/search-params';
import { type CustomerActionKind, type CustomerActionView } from './customer-actions';
import { type CustomerDetailView, type CustomerTab } from './customer-detail-page';

const TABS: readonly CustomerTab[] = ['overview', 'orders', 'sessions', 'activity'];
const KINDS: readonly CustomerActionKind[] = [
  'suspend',
  'reactivate',
  'signOutAll',
  'sendReset',
  'resetAccount',
];
const DEFAULT_CATEGORY: SuspensionCategory = SUSPENSION_CATEGORIES[0];

type LoadState = 'loading' | 'error' | 'ready';
const loadState = (query: { isPending: boolean; isError: boolean; data?: unknown }): LoadState =>
  query.isError && !query.data ? 'error' : query.isPending ? 'loading' : 'ready';

const reasonFits = (reason: string) => {
  const length = reason.trim().length;
  return length >= ADMIN_REASON_LENGTH.min && length <= ADMIN_REASON_LENGTH.max;
};

// The open dialog lives in ?action=, so a row action on the list lands here with it open.
function useCustomerAction(
  handle: string,
  detail: CustomerDetail | undefined,
  canEdit: boolean,
  param: string | null,
): CustomerActionView {
  const suspend = useSuspendCustomer();
  const reactivate = useReactivateCustomer();
  const signOut = useSignOutCustomer();
  const sendReset = useSendCustomerReset();
  const resetAccount = useResetCustomerAccount();
  const { t, f } = useAdminI18n();
  const toast = useToast();
  const mutations = { suspend, reactivate, signOutAll: signOut, sendReset, resetAccount };
  const [category, setCategory] = useState<SuspensionCategory>(DEFAULT_CATEGORY);
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const requested = oneOf<CustomerActionKind | 'none'>(param, KINDS, 'none');
  const kind = canEdit && detail && requested !== 'none' ? requested : null;
  const mutation = kind ? mutations[kind] : null;
  const confirmed = kind !== 'resetAccount' || isResetConfirmed(handle, confirm);
  const close = () => {
    setSearchParams({ action: null }, 'replace');
  };

  const send = () => {
    const body = { reason: reason.trim() };
    const copy = t.admin.customer;
    const done = (message: (response: CustomerActionResponse) => string) => ({
      onSuccess: (response: CustomerActionResponse) => {
        close();
        toast(message(response));
      },
    });
    switch (kind) {
      case 'suspend':
        suspend.mutate(
          { handle, body: { ...body, reasonCategory: category } },
          done(({ customer }) => copy.toasts.suspended({ name: customer.name })),
        );
        break;
      case 'reactivate':
        reactivate.mutate(
          { handle, body },
          done(({ customer }) => copy.toasts.reactivated({ name: customer.name })),
        );
        break;
      case 'signOutAll':
        signOut.mutate(
          { handle, body },
          done(({ sessionsRevoked = 0 }) =>
            copy.toasts.signedOut({ sessions: copy.counts.sessions(f.count(sessionsRevoked)) }),
          ),
        );
        break;
      case 'sendReset':
        sendReset.mutate(
          { handle, body },
          done(() => copy.toasts.resetSent),
        );
        break;
      case 'resetAccount':
        resetAccount.mutate(
          { handle, body: { ...body, confirm } },
          done(() => copy.toasts.accountReset),
        );
        break;
      case null:
        break;
    }
  };

  return {
    kind,
    category,
    reason,
    confirm,
    phrase: resetConfirmation(handle),
    reasonLimits: ADMIN_REASON_LENGTH,
    reasonInvalid: submitted && !reasonFits(reason),
    canSubmit: kind !== null && confirmed && !mutation?.isPending,
    isSaving: mutation?.isPending ?? false,
    failed: mutation?.isError ?? false,
    startingCashCents: POLICY.startingCashCents,
    actions: {
      open: (next) => {
        mutations[next].reset();
        setCategory(DEFAULT_CATEGORY);
        setReason('');
        setConfirm('');
        setSubmitted(false);
        setSearchParams({ action: next }, 'replace');
      },
      close,
      setCategory,
      setReason,
      setConfirm,
      submit: () => {
        setSubmitted(true);
        if (kind && confirmed && reasonFits(reason)) send();
      },
    },
  };
}

export function useCustomerDetailPage(handle: string): CustomerDetailView {
  const { isViewer, canEdit } = useAccess();
  const params = useSearchParams();
  const tab = oneOf(params.get('tab'), TABS, 'overview');
  const customer = useCustomer(handle);
  const orders = useCustomerOrders(handle);
  const sessions = useCustomerSessions(handle);
  const activity = useCustomerActivity(handle);
  const reveal = useRevealCustomer(handle);
  const { sectorOf } = useStockIndex();
  const detail = customer.data;
  const action = useCustomerAction(handle, detail, canEdit, params.get('action'));
  const deletionAt = detail?.customer.deletionRequestedAt ?? null;

  return {
    status: isApiError(customer.error, ErrorCode.NotFound) ? 'notFound' : loadState(customer),
    detail: detail ?? null,
    error: customer.error,
    positions: (detail?.portfolio.positions ?? []).map((position) => {
      const row = customerPositionRow(position);
      return {
        symbol: row.symbol,
        sector: sectorOf(row.symbol) ?? 'tech',
        qtyMicros: row.qtyMicros,
        avgCostCents: dollarsToCents(ticksToDollars(row.avgCostTicks)),
        marketValueCents: row.marketValueCents,
        returnCents: row.returnCents,
        returnBps: row.returnBps,
      };
    }),
    purgesAt: deletionAt === null ? null : deletionAt + AUTH_TTL_MS.deletionGrace,
    isViewer,
    canEdit,
    tab,
    now: customer.dataUpdatedAt,
    listHref: '/customers',
    orders: { items: orders.items, status: loadState(orders) },
    sessions: {
      items: sessions.data?.items ?? [],
      status: loadState(sessions),
      fullIps: reveal.isSuccess ? Object.fromEntries(reveal.ips) : null,
      isRevealing: reveal.isPending,
    },
    activity: {
      items: activity.items.map((item) => ({
        id: item.id,
        at: item.at,
        actor: item.actor,
        action: item.action,
        preview: auditPreview(item.detail),
      })),
      status: loadState(activity),
      hasMore: activity.hasNextPage,
      isFetchingMore: activity.isFetchingNextPage,
    },
    action,
    actions: {
      retry: () => void customer.refetch(),
      setTab: (next) => {
        setSearchParams({ tab: next === 'overview' ? null : next }, 'replace');
      },
      retryOrders: () => void orders.refetch(),
      retrySessions: () => void sessions.refetch(),
      // ADMIN only: the server audits every reveal as customer.pii_viewed.
      revealIps: () => {
        if (canEdit) reveal.reveal();
      },
      hideIps: () => {
        reveal.reset();
      },
      retryActivity: () => void activity.refetch(),
      loadMoreActivity: () => void activity.fetchNextPage(),
    },
  };
}
