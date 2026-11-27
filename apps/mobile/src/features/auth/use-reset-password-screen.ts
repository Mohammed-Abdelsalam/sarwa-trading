import { router } from 'expo-router';

import { AUTH_TTL_MS } from '@sarwa/contracts';
import { useResetPassword } from '@sarwa/core';

import { deviceModel } from '../../lib/device';
import { useCopy } from '../../lib/i18n';
import { goBack } from '../../lib/navigation';
import { authNotice, fieldErrorText, strengthOf, submitModel, useFields } from './auth-form';
import { type ResetPasswordView } from './reset-password-screen';

const MINUTE_MS = 60_000;

export function useResetPasswordScreen(token: string): ResetPasswordView {
  const copy = useCopy();
  const { t, f } = copy;
  const form = useResetPassword(token);
  const { values, field } = useFields(['password', 'confirm'], () => {
    if (!form.isPending) form.reset();
  });

  if (form.isSuccess)
    return {
      state: 'done',
      onContinue: () => {
        router.replace('/(tabs)');
      },
    };
  if (form.link === 'checking') return { state: 'checking', onClose: goBack };
  if (form.link === 'expired')
    return {
      state: 'expired',
      duration: t.counts.minutes(f.count(AUTH_TTL_MS.passwordReset / MINUTE_MS)),
      onRequestNew: () => {
        router.replace('/forgot-password');
      },
      onClose: goBack,
    };
  return {
    state: 'form',
    email: form.email ?? undefined,
    password: field('password', fieldErrorText(form.fieldErrors.password, copy)),
    confirm: field('confirm', fieldErrorText(form.fieldErrors.confirm, copy)),
    strength: strengthOf(values.password),
    matches: values.confirm.length > 0 && values.confirm === values.password,
    notice: authNotice(form, copy),
    submit: submitModel(form, () => {
      form.submit({ ...values, keepSignedIn: true, deviceModel: deviceModel() });
    }),
    onClose: goBack,
  };
}
