import { useRouter } from 'next/navigation';

import { type SignedOutReason, useSession } from '@sarwa/core';

import { AUTH_ROUTES } from '../auth/auth-view';

export interface SignedOutView {
  // null hides the dialog; a suspension has its own page instead.
  reason: Exclude<SignedOutReason, 'suspended'> | null;
  actions: { signIn: () => void; resetPassword: () => void; dismiss: () => void };
}

// "You were signed out": the server revoked this session, or it could not be renewed.
export function useSignedOutDialog(): SignedOutView {
  const session = useSession();
  const router = useRouter();
  const reason = session.revokedReason;
  const go = (href: typeof AUTH_ROUTES.signIn) => {
    session.acknowledge();
    router.push(href);
  };
  return {
    reason: reason && reason !== 'suspended' ? reason : null,
    actions: {
      signIn: () => {
        go(AUTH_ROUTES.signIn);
      },
      resetPassword: () => {
        go(AUTH_ROUTES.forgot);
      },
      dismiss: session.acknowledge,
    },
  };
}
