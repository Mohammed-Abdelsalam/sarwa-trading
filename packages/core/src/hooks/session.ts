import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';

import { type CustomerUser } from '@sarwa/contracts';

import { shouldRetry } from '../api';
import {
  type ClientAuth,
  createSessionStore,
  endSession,
  isSessionRefused,
  type SessionState,
} from '../auth/session';
import { reauthenticate } from '../market-socket';
import { useSarwa } from '../provider';
import { ME_SCOPE, meKeys, queryKeys } from './keys';

// Without customer auth wired (tests, apps before accounts) the device is the one identity.
export const DEVICE_SCOPE = 'device';
const deviceSession = createSessionStore({
  status: 'authenticated',
  user: null,
  suspension: null,
  revokedReason: null,
});

export function useSessionState<T>(select: (state: SessionState) => T): T {
  const { auth } = useSarwa();
  return useStore(auth?.session ?? deviceSession, select);
}

export function useClientAuth(): ClientAuth {
  const { auth } = useSarwa();
  if (!auth) throw new Error('Customer auth needs createSarwaClient({ authTransport })');
  return auth;
}

export function useSession() {
  const { auth } = useSarwa();
  const state = useSessionState((s) => s);
  return {
    status: state.status,
    user: state.user,
    suspension: state.suspension,
    revokedReason: state.revokedReason,
    isAuthenticated: state.status === 'authenticated',
    isGuest: state.status === 'guest' || state.status === 'suspended',
    acknowledge: () => {
      auth?.session.getState().acknowledge();
    },
  };
}

// Personal queries: keyed by who is signed in, and only fetched while someone is.
export function usePrivateScope() {
  const enabled = useSessionState((s) => s.status === 'authenticated');
  const userId = useSessionState((s) => s.user?.id ?? DEVICE_SCOPE);
  const keys = useMemo(() => meKeys(userId), [userId]);
  return { keys, enabled };
}

const identityOf = (state: SessionState) =>
  state.status === 'authenticated' ? (state.user?.id ?? DEVICE_SCOPE) : null;

export interface AuthSyncOptions {
  // Called with the new user id (null for a guest), e.g. to switch the mobile persister's scope.
  onIdentityChange?: (userId: string | null) => void;
}

// Without network at launch the app opens as the saved user (or a guest), keeping the tokens.
async function openOffline(auth: ClientAuth, opened: () => void) {
  const user = (await auth.transport.savedUser?.().catch(() => null)) ?? null;
  const session = auth.session.getState();
  if (session.status !== 'loading') return;
  opened();
  if (user) session.signIn(user);
  else session.signOut();
}

// The server answered after an offline launch: the fresh user, or a session that is over.
async function confirmOnline(auth: ClientAuth, user: CustomerUser | null, unauthorized: boolean) {
  const session = auth.session.getState();
  if (user) session.signIn(user);
  else if (unauthorized)
    await endSession(auth, session.status === 'authenticated' ? 'expired' : undefined);
}

// Mount once per app, next to useTradingEvents: restores the session at launch, follows identity
// changes and signs out when the server revokes this session.
export function useAuthSync({ onIdentityChange }: AuthSyncOptions = {}): void {
  const { auth, api, market, store } = useSarwa();
  const queryClient = useQueryClient();
  const loading = useSessionState((s) => s.status === 'loading');
  // Opened offline: `me` keeps retrying (on reconnect and focus) until the server answers.
  const [unconfirmed, setUnconfirmed] = useState(false);
  const identityChanged = useRef(onIdentityChange);

  useEffect(() => {
    identityChanged.current = onIdentityChange;
  }, [onIdentityChange]);

  const me = useQuery({
    queryKey: queryKeys.session,
    queryFn: async ({ signal }) =>
      auth && (await auth.transport.hasCredentials()) ? api.getMe({ signal }) : null,
    enabled: auth !== undefined && (loading || unconfirmed),
    retry: shouldRetry,
    gcTime: 0,
  });
  // A server outage or rate limit opens like no network: `me` keeps retrying, the tokens stay.
  const offline =
    me.fetchStatus === 'paused' ||
    (me.failureReason !== null && !isSessionRefused(me.failureReason));

  useEffect(() => {
    const session = auth?.session.getState();
    if (!auth || session?.status !== 'loading') return;
    if (me.data) session.signIn(me.data);
    else if (me.data === null || isSessionRefused(me.error)) void endSession(auth);
    else if (offline)
      void openOffline(auth, () => {
        setUnconfirmed(true);
      });
  }, [auth, me.data, me.error, offline]);

  useEffect(() => {
    if (!auth || !unconfirmed || loading) return;
    const unauthorized = isSessionRefused(me.error);
    if (me.data === undefined && !unauthorized) return;
    void confirmOnline(auth, me.data ?? null, unauthorized).then(() => {
      setUnconfirmed(false);
    });
  }, [auth, unconfirmed, loading, me.data, me.error]);

  useEffect(() => {
    if (!auth) return;
    let previous = identityOf(auth.session.getState());
    return auth.session.subscribe((state) => {
      const next = identityOf(state);
      if (next === previous) return;
      previous = next;
      void queryClient.cancelQueries({ queryKey: ME_SCOPE });
      queryClient.removeQueries({ queryKey: ME_SCOPE });
      reauthenticate(market, store);
      identityChanged.current?.(next);
    });
  }, [auth, queryClient, market, store]);

  useEffect(() => {
    if (!auth) return;
    return market.onTradingEvent((event) => {
      if (event.name !== 'session.revoked') return;
      void endSession(auth, event.payload.reason, event.payload.suspension);
    });
  }, [auth, market]);
}
