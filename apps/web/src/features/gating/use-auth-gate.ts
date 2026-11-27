import { type Sector } from '@sarwa/contracts';
import { type AuthIntent, type Cents, parseCents, useGate, useStocks } from '@sarwa/core';

import { useSignInPage, type SignInView } from '../auth/use-sign-in-page';
import { useSignUpPage, type SignUpView } from '../auth/use-sign-up-page';
import { type GateTab, useAuthUi } from './auth-ui';

export type { GateTab } from './auth-ui';

export type GateAction = 'buy' | 'sell' | 'alert' | 'portfolio' | 'orders' | 'notifications';

// What the guest tried to do; the gate title names it and sign-in returns to it.
export interface GateIntent {
  action: GateAction;
  // Named in the title even before the stock list has loaded.
  symbol?: string;
  stock?: { symbol: string; sector: Sector };
  // A gated order's amount, promised back pre-filled.
  amountCents?: Cents;
}

export interface AuthGateView {
  // null while the gate is closed.
  intent: GateIntent | null;
  tab: GateTab;
  signUp: SignUpView;
  signIn: SignInView;
  actions: {
    setTab: (tab: GateTab) => void;
    close: () => void;
  };
}

export function gateIntent(intent: AuthIntent, sectorOf: (symbol: string) => Sector | undefined) {
  const stock = (symbol: string | undefined) => {
    const sector = symbol ? sectorOf(symbol) : undefined;
    return symbol && sector ? { symbol, sector } : undefined;
  };
  if (intent.kind === 'order') {
    const amount = intent.form?.sizeMode === 'amount' ? parseCents(intent.form.amountText) : null;
    return {
      action: intent.side,
      symbol: intent.symbol,
      stock: stock(intent.symbol),
      amountCents: amount && amount > 0 ? amount : undefined,
    } satisfies GateIntent;
  }
  if (intent.kind === 'alert')
    return { action: intent.kind, symbol: intent.symbol, stock: stock(intent.symbol) };
  return { action: intent.kind } as const;
}

export function useAuthGate(): AuthGateView {
  const gate = useGate();
  const { tab, setTab } = useAuthUi();
  const signUp = useSignUpPage({ inGate: true });
  const signIn = useSignInPage({ inGate: true });
  const stocks = useStocks().data;
  return {
    intent:
      gate.isOpen && gate.intent
        ? gateIntent(gate.intent, (symbol) => stocks?.find((s) => s.symbol === symbol)?.sector)
        : null,
    tab,
    signUp,
    signIn,
    actions: {
      setTab,
      close: () => {
        gate.close();
        setTab('signUp');
      },
    },
  };
}
