import { useEffect } from 'react';
import { useStore } from 'zustand';

import { type AuthIntent, createGateStore } from '../auth/session';
import { useSarwa } from '../provider';
import { useSessionState } from './session';

const closedGate = createGateStore();

// Personal actions go through run(): a guest gets the sign-in gate, and the intent waits for them.
export function useRequireAuth() {
  const { auth } = useSarwa();
  const allowed = useSessionState((s) => s.status === 'authenticated');
  return {
    allowed,
    run: (intent: AuthIntent, action: () => void) => {
      if (!auth || auth.session.getState().status === 'authenticated') {
        action();
        return;
      }
      auth.intents.save(intent).catch(() => undefined);
      auth.gate.getState().open(intent);
    },
  };
}

// The web modal and the mobile sheet render from this.
export function useGate() {
  const { auth } = useSarwa();
  const gate = auth?.gate ?? closedGate;
  const isOpen = useStore(gate, (s) => s.isOpen);
  const intent = useStore(gate, (s) => s.intent);
  const resumed = useStore(gate, (s) => s.resumed);
  return {
    isOpen,
    intent,
    open: gate.getState().open,
    close: gate.getState().close,
    // What the guest was doing, back after sign-in; the screen that reopens it consumes it.
    resumed,
    consume: gate.getState().consume,
  };
}

// Mount once at the root: after sign-in it hands back what the guest was doing until a screen
// consumes it, so the app can navigate there. An order only reopens prefilled, never sent.
export function useResumeIntent(): AuthIntent | null {
  const { auth } = useSarwa();
  const authenticated = useSessionState((s) => s.status === 'authenticated');
  const resumed = useStore(auth?.gate ?? closedGate, (s) => s.resumed);

  useEffect(() => {
    if (!auth) return;
    const { resume, consume } = auth.gate.getState();
    if (!authenticated) {
      consume();
      return;
    }
    void auth.intents.take().then((taken) => {
      if (taken) resume(taken);
    });
  }, [auth, authenticated]);

  return resumed;
}
