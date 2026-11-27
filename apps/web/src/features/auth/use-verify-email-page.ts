import { useResendVerification, useVerifyEmail } from '@sarwa/core';

import { useSearchParam } from '../../lib/browser';
import { type ResendState, resendState } from './auth-view';

export interface VerifyEmailView {
  status: 'checking' | 'ok' | 'expired';
  // From the success response, or the expired problem when the server still knows the address.
  email: string | null;
  resend: ResendState;
  actions: { resend: () => void };
}

export function useVerifyEmailPage(): VerifyEmailView {
  const verify = useVerifyEmail(useSearchParam('token') ?? '');
  const resend = useResendVerification();
  const status =
    verify.state === 'checking' ? 'checking' : verify.state === 'ready' ? 'ok' : 'expired';
  return {
    status,
    email: verify.email,
    resend: resendState(resend),
    actions: {
      resend: () => {
        resend.resend(verify.email ?? undefined);
      },
    },
  };
}
