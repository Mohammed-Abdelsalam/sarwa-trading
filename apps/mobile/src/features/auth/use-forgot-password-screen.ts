import { Linking } from 'react-native';

import { AUTH_TTL_MS } from '@sarwa/contracts';
import { useForgotPassword } from '@sarwa/core';

import { useCopy } from '../../lib/i18n';
import { goBack } from '../../lib/navigation';
import { authNotice, fieldErrorText, submitModel, useFields } from './auth-form';
import { type ForgotPasswordView } from './forgot-password-screen';

const MINUTE_MS = 60_000;

// iOS opens Mail's inbox; elsewhere the mail app opens to a new message.
export function openMailApp() {
  void Linking.openURL('message:').catch(() => Linking.openURL('mailto:').catch(() => undefined));
}

export function useForgotPasswordScreen(): ForgotPasswordView {
  const copy = useCopy();
  const { t, f } = copy;
  const form = useForgotPassword();
  const { values, field } = useFields(['email'], () => {
    if (!form.isPending) form.reset();
  });

  return {
    email: field('email', fieldErrorText(form.fieldErrors.email, copy)),
    notice: authNotice(form, copy),
    submit: submitModel(form, () => {
      form.submit(values);
    }),
    sent: form.sentTo
      ? {
          email: form.sentTo,
          expiresIn: t.counts.minutes(f.count(AUTH_TTL_MS.passwordReset / MINUTE_MS)),
          resendIn: form.resendIn ?? undefined,
          onResend: form.resend,
          onOpenMail: openMailApp,
        }
      : undefined,
    onBack: goBack,
  };
}
