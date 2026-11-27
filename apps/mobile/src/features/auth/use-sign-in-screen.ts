import { router } from 'expo-router';
import { useEffect } from 'react';

import { useSignIn } from '@sarwa/core';

import { deviceModel } from '../../lib/device';
import { useCopy } from '../../lib/i18n';
import { goBack } from '../../lib/navigation';
import { showToast } from '../../lib/toast';
import { authNotice, fieldErrorText, submitModel, useFields } from './auth-form';
import { type SignInView } from './sign-in-screen';

export function useSignInScreen(): SignInView {
  const copy = useCopy();
  const { t, f } = copy;
  const form = useSignIn();
  const { values, field } = useFields(['email', 'password'], () => {
    if (!form.isPending) form.reset();
  });
  const errors = form.fieldErrors;
  const deletionCanceled = form.data?.deletionCanceled === true;

  useEffect(() => {
    if (!form.isSuccess) return;
    if (deletionCanceled) showToast(t.toasts.deletionCanceledTitle);
    goBack();
  }, [form.isSuccess, deletionCanceled, t]);

  const submit = () => {
    form.submit({ ...values, keepSignedIn: true, deviceModel: deviceModel() });
  };

  return {
    email: field('email', fieldErrorText(errors.email, copy)),
    password: field('password', fieldErrorText(errors.password, copy)),
    notice: authNotice(form, copy),
    submit: submitModel(form, submit),
    guestData: form.counts
      ? {
          positions: t.counts.positions(f.count(form.counts.positions)),
          orders: t.counts.openOrders(f.count(form.counts.openOrders)),
          watchlist: t.counts.watchlist(f.count(form.counts.watchlist)),
          onConfirm: form.confirm,
          onCancel: form.cancel,
          confirming: form.isPending,
        }
      : undefined,
    onForgot: () => {
      router.push('/forgot-password');
    },
    onSignUp: () => {
      router.replace('/sign-up');
    },
    onClose: goBack,
  };
}
