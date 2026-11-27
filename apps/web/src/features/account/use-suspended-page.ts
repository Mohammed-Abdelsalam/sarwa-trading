import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { type Suspension } from '@sarwa/contracts';
import { useSession } from '@sarwa/core';

import { useCopy } from '../../lib/i18n';
import { AUTH_ROUTES } from '../auth/auth-view';

export interface SuspendedView {
  // Kept in memory from the 403 ACCOUNT_SUSPENDED body or the session.revoked payload.
  suspension: Suspension | null;
  supportHref: string;
  actions: { signOut: () => void };
}

export function useSuspendedPage(): SuspendedView {
  const session = useSession();
  const router = useRouter();
  const { t } = useCopy();
  return {
    suspension: session.suspension,
    supportHref: `mailto:${t.support.email}`,
    actions: {
      // Already signed out everywhere: this only carries on as a guest.
      signOut: () => {
        session.acknowledge();
        router.replace(AUTH_ROUTES.markets);
      },
    },
  };
}

// Wherever the suspension arrives (sign-in answer or a live revoke), the app moves to /suspended.
export function useSuspendedRedirect(): void {
  const { status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (status === 'suspended' && pathname !== AUTH_ROUTES.suspended)
      router.replace(AUTH_ROUTES.suspended);
  }, [status, pathname, router]);
}
