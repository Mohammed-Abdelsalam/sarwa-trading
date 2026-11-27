import { router } from 'expo-router';
import { useEffect } from 'react';

import { AUTH_TTL_MS } from '@sarwa/contracts';
import {
  cents,
  DELETE_CONFIRM,
  POLICY,
  RESET_CONFIRM,
  useDeleteAccount,
  useMeSummary,
  usePortfolio,
  useSelfReset,
} from '@sarwa/core';

import { useCopy } from '../../lib/i18n';
import { goBack } from '../../lib/navigation';
import { showToast } from '../../lib/toast';
import { authNotice, fieldErrorText, submitModel, useFields } from '../auth/auth-form';
import { type DeleteAccountView, type ResetAccountView } from './danger-screens';

const DAY_MS = 86_400_000;

export function useDeleteAccountScreen(): DeleteAccountView {
  const copy = useCopy();
  const { t, f } = copy;
  const form = useDeleteAccount();
  const summary = useMeSummary().data;
  const { values, field } = useFields(['password', 'confirm'], () => {
    if (!form.isPending) form.reset();
  });
  const grace = t.counts.days(f.count(AUTH_TTL_MS.deletionGrace / DAY_MS));
  const { purgeAt } = form;

  useEffect(() => {
    if (purgeAt === null) return;
    showToast(t.toasts.deletionRequested({ date: f.date(purgeAt) }));
    router.replace('/(tabs)');
  }, [purgeAt, t, f]);

  return {
    grace,
    consequences: summary
      ? t.account.deleteDialog.body({
          equity: f.money(cents(summary.equityCents)),
          orders: t.counts.openOrders(f.count(summary.openOrders)),
          watchlists: t.counts.watchlist(f.count(summary.watchlist)),
          alerts: t.counts.alerts(f.count(summary.alerts)),
          days: grace,
        })
      : '',
    password: field('password', fieldErrorText(form.fieldErrors.password, copy)),
    confirm: {
      ...field('confirm', fieldErrorText(form.fieldErrors.confirm, copy)),
      word: DELETE_CONFIRM,
    },
    notice: authNotice(form, copy),
    submit: submitModel(form, () => {
      form.submit({ password: values.password, confirm: values.confirm as typeof DELETE_CONFIRM });
    }),
    onCancel: goBack,
  };
}

export function useResetAccountScreen(): ResetAccountView {
  const copy = useCopy();
  const { t, f } = copy;
  const form = useSelfReset();
  const portfolio = usePortfolio().summary;
  const summary = useMeSummary().data;
  const { values, field } = useFields(['confirm'], () => {
    if (!form.isPending) form.reset();
  });
  const start = f.money(POLICY.startingCashCents, { whole: true });

  useEffect(() => {
    if (!form.isSuccess) return;
    showToast(t.toasts.accountReset({ amount: start }));
    goBack();
  }, [form.isSuccess, start, t]);

  return {
    consequences: t.account.resetDialog.body({
      positions: t.counts.positions(f.count(portfolio?.positions.length ?? 0)),
      orders: t.counts.openOrders(f.count(summary?.openOrders ?? 0)),
      amount: start,
    }),
    equityNow: portfolio ? f.money(portfolio.equityCents) : '',
    equityAfter: start,
    confirm: {
      ...field('confirm', fieldErrorText(form.fieldErrors.confirm, copy)),
      word: RESET_CONFIRM,
    },
    notice: authNotice(form, copy),
    submit: submitModel(form, () => {
      form.submit({ confirm: values.confirm as typeof RESET_CONFIRM });
    }),
    onCancel: goBack,
  };
}
