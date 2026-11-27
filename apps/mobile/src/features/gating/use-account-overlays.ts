import { router } from 'expo-router';
import { useEffect, useEffectEvent } from 'react';

import {
  type AuthIntent,
  parseCents,
  POLICY,
  useGate,
  useResumeIntent,
  useSession,
} from '@sarwa/core';

import { type Copy, useCopy } from '../../lib/i18n';
import { type SignedOutView } from '../account/session-ended';
import { type AuthGateView, type GateIntent } from './auth-gate-sheet';

export function gateIntent(intent: AuthIntent, { f }: Copy): GateIntent {
  if (intent.kind === 'order') {
    const cents = intent.form?.sizeMode === 'amount' ? parseCents(intent.form.amountText) : null;
    return { kind: intent.side, symbol: intent.symbol, amount: cents ? f.money(cents) : undefined };
  }
  if (intent.kind === 'alert') return { kind: 'alert', symbol: intent.symbol };
  return intent;
}

// After sign-in the guest lands back on what they were doing; orders reopen filled in, never sent.
export function resumeIntent(intent: AuthIntent) {
  switch (intent.kind) {
    case 'order':
      router.push({
        pathname: '/order/new',
        params: {
          symbol: intent.symbol,
          side: intent.side,
          ...(intent.form && { form: JSON.stringify(intent.form) }),
        },
      });
      return;
    case 'alert':
      router.push({ pathname: '/alerts', params: intent.symbol ? { symbol: intent.symbol } : {} });
      return;
    case 'portfolio':
      router.navigate('/portfolio');
      return;
    case 'orders':
      router.push('/orders');
      return;
    case 'notifications':
      router.push('/notifications');
  }
}

// The root sheets: the sign-in gate, "You were signed out", and the suspended redirect.
export function useAccountOverlays(): { gate: AuthGateView; signedOut: SignedOutView } {
  const copy = useCopy();
  const gate = useGate();
  const session = useSession();
  const resumed = useResumeIntent();
  const { status, revokedReason, acknowledge } = session;

  useEffect(() => {
    if (status === 'suspended') router.replace('/suspended');
  }, [status]);

  // Route params carry everything the next screen needs, so the intent is done once navigated.
  const resume = useEffectEvent((intent: AuthIntent) => {
    resumeIntent(intent);
    gate.consume();
  });
  useEffect(() => {
    if (resumed) resume(resumed);
  }, [resumed]);

  const leaveGate = (path: '/sign-up' | '/sign-in') => () => {
    gate.close();
    router.push(path);
  };
  const leaveSheet = (path: '/sign-in' | '/forgot-password') => () => {
    acknowledge();
    router.push(path);
  };

  return {
    gate: {
      intent: gate.isOpen && gate.intent ? gateIntent(gate.intent, copy) : null,
      startingCash: copy.f.money(POLICY.startingCashCents, { whole: true }),
      onCreateAccount: leaveGate('/sign-up'),
      onSignIn: leaveGate('/sign-in'),
      onClose: gate.close,
    },
    signedOut: {
      reason: status === 'guest' && revokedReason !== 'suspended' ? revokedReason : null,
      onSignIn: leaveSheet('/sign-in'),
      onResetPassword: leaveSheet('/forgot-password'),
      onClose: acknowledge,
    },
  };
}
