import { z } from 'zod';
import { createStore } from 'zustand/vanilla';

import {
  AlertConditionSchema,
  AUTH_TTL_MS,
  type AuthSessionResponse,
  type CustomerUser,
  OrderTypeSchema,
  type SessionRevokedReason,
  SideSchema,
  type Suspension,
  SymbolSchema,
  TimeInForceSchema,
} from '@sarwa/contracts';

import { ApiError, type RequestAuth } from '../api';
import { type KeyValueStorage } from '../device';
import { type AuthTransport } from './transport';

export type SessionStatus = 'loading' | 'guest' | 'authenticated' | 'suspended';
// Why this client lost its session: the server's revoke reason, or a refresh that failed.
export type SignedOutReason = SessionRevokedReason | 'expired';

export interface SessionState {
  status: SessionStatus;
  user: CustomerUser | null;
  suspension: Suspension | null;
  revokedReason: SignedOutReason | null;
  signIn(user: CustomerUser): void;
  update(user: CustomerUser): void;
  signOut(reason?: SignedOutReason): void;
  suspend(suspension: Suspension): void;
  // The "You were signed out" sheet or the suspended screen was dismissed: carry on as a guest.
  acknowledge(): void;
}

export type SessionStore = ReturnType<typeof createSessionStore>;

type SessionData = Pick<SessionState, 'status' | 'user' | 'suspension' | 'revokedReason'>;

const LOADING: SessionData = {
  status: 'loading',
  user: null,
  suspension: null,
  revokedReason: null,
};

export function createSessionStore(initial: SessionData = LOADING) {
  return createStore<SessionState>()((set) => ({
    ...initial,
    signIn: (user) => {
      set({ status: 'authenticated', user, suspension: null, revokedReason: null });
    },
    update: (user) => {
      set((state) => (state.user?.id === user.id ? { user } : state));
    },
    signOut: (reason) => {
      set({ status: 'guest', user: null, suspension: null, revokedReason: reason ?? null });
    },
    suspend: (suspension) => {
      set({ status: 'suspended', user: null, suspension, revokedReason: 'suspended' });
    },
    acknowledge: () => {
      set((state) =>
        state.status === 'suspended'
          ? { status: 'guest', suspension: null, revokedReason: null }
          : { revokedReason: null },
      );
    },
  }));
}

const TicketFormSchema = z.object({
  side: SideSchema,
  type: OrderTypeSchema,
  tif: TimeInForceSchema,
  sizeMode: z.enum(['amount', 'shares']),
  amountText: z.string().max(32),
  qtyText: z.string().max(32),
  limitText: z.string().max(32),
  stopText: z.string().max(32),
  sellAll: z.boolean(),
});

// What a guest was doing when the gate opened; orders come back prefilled, never sent.
export const AuthIntentSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('order'),
    symbol: SymbolSchema,
    side: SideSchema,
    form: TicketFormSchema.optional(),
  }),
  z.object({
    kind: z.literal('alert'),
    symbol: SymbolSchema.optional(),
    condition: AlertConditionSchema.optional(),
    target: z.string().max(32).optional(),
  }),
  z.object({ kind: z.enum(['portfolio', 'orders', 'notifications']) }),
]);

export type AuthIntent = z.infer<typeof AuthIntentSchema>;

const StoredIntentSchema = z.object({ intent: AuthIntentSchema, at: z.number() });

export interface IntentStorage {
  save(intent: AuthIntent): Promise<void>;
  // The saved intent if it is still fresh; either way it is gone afterwards.
  take(): Promise<AuthIntent | null>;
}

const INTENT_KEY = 'sarwa.authIntent';

export function createIntentStorage(
  storage: KeyValueStorage,
  now: () => number = Date.now,
): IntentStorage {
  return {
    save: (intent) => storage.setItem(INTENT_KEY, JSON.stringify({ intent, at: now() })),
    take: async () => {
      const raw = await storage.getItem(INTENT_KEY);
      if (!raw) return null;
      await storage.setItem(INTENT_KEY, '');
      try {
        const parsed = StoredIntentSchema.safeParse(JSON.parse(raw));
        return parsed.success && now() - parsed.data.at <= AUTH_TTL_MS.authIntent
          ? parsed.data.intent
          : null;
      } catch {
        return null;
      }
    },
  };
}

// The sign-in prompt for a gated action; apps render it as a modal (web) or a sheet (mobile).
export interface GateState {
  intent: AuthIntent | null;
  isOpen: boolean;
  // Handed back after sign-in until the screen it reopens consumes it.
  resumed: AuthIntent | null;
  open: (intent: AuthIntent) => void;
  close: () => void;
  resume: (intent: AuthIntent | null) => void;
  consume: () => void;
}

export type GateStore = ReturnType<typeof createGateStore>;

export function createGateStore() {
  return createStore<GateState>()((set) => ({
    intent: null,
    isOpen: false,
    resumed: null,
    open: (intent) => {
      set({ intent, isOpen: true });
    },
    close: () => {
      set({ isOpen: false });
    },
    resume: (resumed) => {
      set({ resumed });
    },
    consume: () => {
      set({ resumed: null });
    },
  }));
}

export interface ClientAuth {
  transport: AuthTransport;
  session: SessionStore;
  gate: GateStore;
  intents: IntentStorage;
}

export async function startSession(auth: ClientAuth, response: AuthSessionResponse) {
  await auth.transport.save(response);
  auth.session.getState().signIn(response.user);
  auth.gate.getState().close();
}

export async function endSession(
  auth: ClientAuth,
  reason?: SignedOutReason,
  suspension?: Suspension,
) {
  await auth.transport.clear().catch(() => undefined);
  if (suspension) auth.session.getState().suspend(suspension);
  else auth.session.getState().signOut(reason);
}

// Only the server refusing the session ends it; outages, rate limits and network failures keep it.
export function isSessionRefused(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

// The auth slot for createRequest. Concurrent 401s share one refresh, so a rotated refresh token
// is never sent twice.
export function createSessionAuth({
  auth,
  refreshSession,
  onRenewed,
}: {
  auth: ClientAuth;
  refreshSession: (body: { refreshToken?: string }) => Promise<AuthSessionResponse>;
  onRenewed?: () => void;
}): RequestAuth {
  let renewing: Promise<boolean> | null = null;
  const renew = async () => {
    const body = await auth.transport.refreshBody();
    if (!body) return false;
    try {
      const response = await refreshSession(body);
      await auth.transport.save(response);
      auth.session.getState().update(response.user);
      onRenewed?.();
      return true;
    } catch (error) {
      if (isSessionRefused(error)) return false;
      throw error;
    }
  };
  return {
    credentials: auth.transport.credentials,
    headers: (request) => auth.transport.headers(request),
    refresh: () =>
      (renewing ??= renew().finally(() => {
        renewing = null;
      })),
    onUnauthorized: () => {
      const { status } = auth.session.getState();
      if (status === 'authenticated') void endSession(auth, 'expired');
      else if (status === 'loading') void endSession(auth);
    },
  };
}
