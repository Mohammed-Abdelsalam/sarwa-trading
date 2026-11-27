import { router } from 'expo-router';

import { AUTH_TTL_MS } from '@sarwa/contracts';
import { useResendVerification, useVerifyEmail } from '@sarwa/core';

import { useCopy } from '../../lib/i18n';
import { goBack } from '../../lib/navigation';
import { type VerifyEmailView } from './verify-email-screen';

const HOUR_MS = 3_600_000;

export function useVerifyEmailScreen(token: string): VerifyEmailView {
  const { t, f } = useCopy();
  const verify = useVerifyEmail(token);
  const resend = useResendVerification();
  const { email } = verify;

  if (verify.state === 'checking') return { state: 'checking' };
  if (verify.state === 'ready')
    return {
      state: 'verified',
      email: email ?? '',
      onContinue: () => {
        router.replace('/(tabs)');
      },
    };
  if (verify.state === 'failed') return { state: 'failed', onClose: goBack };
  const duration = t.common.hours(f.count(AUTH_TTL_MS.emailVerify / HOUR_MS));
  return {
    state: 'expired',
    body: email
      ? t.auth.verify.expiredBody({ duration, email })
      : t.auth.verify.expiredBodyNoEmail({ duration }),
    resend: email
      ? {
          label: resend.resendIn
            ? t.auth.forgot.resendInShort({ time: resend.resendIn })
            : t.auth.verify.resend,
          disabled: !resend.canResend,
          sentTo: resend.sent ? email : undefined,
          onPress: () => {
            resend.resend(email);
          },
        }
      : undefined,
    onClose: goBack,
  };
}
