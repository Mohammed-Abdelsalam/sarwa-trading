import { type AuthIntent, useSession, useStocks } from '@sarwa/core';

import { useOpenGate } from './auth-ui';
import { type GuestEmptyKind } from './guest-views';

// The gate intent each personal page hands back after sign-in.
const INTENTS: Record<GuestEmptyKind, AuthIntent> = {
  portfolio: { kind: 'portfolio' },
  orders: { kind: 'orders' },
  alerts: { kind: 'alert' },
};

export function usePersonalPage(kind: GuestEmptyKind) {
  const { status } = useSession();
  const openGate = useOpenGate();
  const stockCount = useStocks().data?.length ?? 0;
  const intent = INTENTS[kind];
  return {
    status:
      status === 'authenticated'
        ? ('member' as const)
        : status === 'loading'
          ? ('loading' as const)
          : ('guest' as const),
    stockCount,
    onCreate: () => {
      openGate(intent);
    },
    onSignIn: () => {
      openGate(intent, 'signIn');
    },
  };
}
