import { useState } from 'react';

import { useResendVerification, useSession } from '@sarwa/core';

import { type ResendState, resendState } from '../auth/auth-view';

export interface VerifyBannerView {
  // null hides the banner: verified, signed out or dismissed.
  email: string | null;
  resend: ResendState;
  actions: { resend: () => void; dismiss: () => void };
}

export function useVerifyBanner(): VerifyBannerView {
  const { user } = useSession();
  const resend = useResendVerification();
  const [dismissed, setDismissed] = useState(false);
  return {
    email: user && !user.emailVerified && !dismissed ? user.email : null,
    resend: resendState(resend),
    actions: {
      resend: () => {
        resend.resend();
      },
      dismiss: () => {
        setDismissed(true);
      },
    },
  };
}
