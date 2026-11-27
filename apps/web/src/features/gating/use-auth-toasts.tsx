import { useRouter } from 'next/navigation';

import { type AuthSessionResponse } from '@sarwa/contracts';

import { useToast } from '../../components/layout/toast-host';
import { AUTH_ROUTES } from '../auth/auth-view';
import { ClaimedToast, DeletionCanceledToast, ReadyToast } from './auth-toasts';

// What a fresh session announces: a kept guest portfolio, a new account or a canceled deletion.
export function useAuthToasts() {
  const show = useToast();
  const router = useRouter();
  return {
    signedUp: ({ user, claimed }: AuthSessionResponse, { greet }: { greet: boolean }) => {
      if (claimed && (claimed.positions > 0 || claimed.openOrders > 0)) {
        show((dismiss) => <ClaimedToast counts={claimed} onDismiss={dismiss} />);
        return;
      }
      show((dismiss) => (
        <ReadyToast
          name={greet ? user.name : undefined}
          onDismiss={dismiss}
          onTrade={() => {
            dismiss();
            router.push(AUTH_ROUTES.markets);
          }}
        />
      ));
    },
    signedIn: ({ deletionCanceled }: AuthSessionResponse) => {
      if (deletionCanceled) show((dismiss) => <DeletionCanceledToast onDismiss={dismiss} />);
    },
  };
}
