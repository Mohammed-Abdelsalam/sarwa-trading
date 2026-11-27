'use client';

import { type Route } from 'next';
import { useRouter } from 'next/navigation';
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useEffectEvent,
  useState,
} from 'react';

import { type AuthIntent, useGate, useRequireAuth, useResumeIntent } from '@sarwa/core';

export type GateTab = 'signUp' | 'signIn';

interface AuthUi {
  tab: GateTab;
  setTab: (tab: GateTab) => void;
}

const AuthUiContext = createContext<AuthUi>({
  tab: 'signUp',
  setTab: () => undefined,
});

export function useAuthUi(): AuthUi {
  return useContext(AuthUiContext);
}

// Where each resumed intent lands; an order and an alert reopen their forms there, never sent.
// The ticket, the alert dialog and the inbox consume theirs; the rest are done once navigated.
export function intentHref(intent: AuthIntent): Route | null {
  if (intent.kind === 'order') return `/stocks/${intent.symbol}?trade=${intent.side}` as Route;
  if (intent.kind === 'alert')
    return intent.symbol ? (`/alerts?new=${intent.symbol}` as Route) : '/alerts';
  if (intent.kind === 'portfolio' || intent.kind === 'orders') return `/${intent.kind}`;
  return null;
}

export function AuthUiProvider({ children }: { children: ReactNode }) {
  const [tab, setTab] = useState<GateTab>('signUp');
  const resumed = useResumeIntent();
  const { consume } = useGate();
  const router = useRouter();

  const resume = useEffectEvent((next: AuthIntent) => {
    const href = intentHref(next);
    if (href) router.push(href);
    if (next.kind !== 'order' && next.kind !== 'alert' && next.kind !== 'notifications') consume();
  });
  useEffect(() => {
    if (resumed) resume(resumed);
  }, [resumed]);

  return <AuthUiContext value={{ tab, setTab }}>{children}</AuthUiContext>;
}

// The intent a screen reopens: consumed at once and kept for this mount only, so a later visit
// starts blank.
export function useResumedIntent<T extends AuthIntent>(
  match: (intent: AuthIntent) => intent is T,
): T | null {
  const { resumed, consume } = useGate();
  const mine = resumed && match(resumed) ? resumed : null;
  const [kept, setKept] = useState(mine);
  if (mine && mine !== kept) setKept(mine);
  useEffect(() => {
    if (mine) consume();
  }, [mine, consume]);
  return kept;
}

// Guest calls to action: the gate on the chosen tab, keeping what they were about to do.
export function useOpenGate() {
  const { run } = useRequireAuth();
  const { setTab } = useAuthUi();
  return (intent: AuthIntent, tab: GateTab = 'signUp') => {
    setTab(tab);
    run(intent, () => undefined);
  };
}
