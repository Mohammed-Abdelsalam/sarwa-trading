import { noopAnalytics, type AnalyticsProvider } from './analytics';
import { type ApiClient, createApiClient, type RequestAuth } from './api';
import {
  type ClientAuth,
  createGateStore,
  createIntentStorage,
  createSessionAuth,
  createSessionStore,
  type SessionStatus,
} from './auth/session';
import { type AuthTransport } from './auth/transport';
import { createDeviceIdGetter, type KeyValueStorage } from './device';
import { createMarketSocket, reauthenticate, type SocketTransport } from './market-socket';
import { type SarwaClient } from './provider';
import { createLiveStore } from './store';
import { createRemovalQueue } from './undo';

export interface SarwaClientOptions {
  apiUrl: string;
  // Defaults to apiUrl; the admin dashboard reaches the socket through its own origin instead.
  socketUrl?: string;
  storage: KeyValueStorage;
  // Where the device id lives; mobile keeps it in the keychain while preferences stay in storage.
  identityStorage?: KeyValueStorage;
  randomUUID: () => string;
  transports?: SocketTransport[];
  auth?: RequestAuth;
  // Customer sign-in: webCookieAuth on the web, bearerAuth on mobile. Without it the device id is
  // the only identity, as before accounts.
  authTransport?: AuthTransport;
  // Where a gated action waits while the guest signs in; the web passes sessionStorage.
  intentStorage?: KeyValueStorage;
  // 'guest' when the server render already knows there is no session, so both renders agree on it.
  initialStatus?: Extract<SessionStatus, 'loading' | 'guest'>;
  analytics?: AnalyticsProvider;
}

// One wiring for web, mobile and admin: each app only says where the API is and what it stores in.
export function createSarwaClient({
  apiUrl,
  socketUrl = apiUrl,
  storage,
  identityStorage = storage,
  randomUUID,
  transports,
  auth,
  authTransport,
  intentStorage = storage,
  initialStatus = 'loading',
  analytics = noopAnalytics,
}: SarwaClientOptions): SarwaClient {
  const store = createLiveStore();
  const getDeviceId = createDeviceIdGetter(identityStorage, randomUUID);
  const session: ClientAuth | undefined = authTransport && {
    transport: authTransport,
    session: createSessionStore({
      status: initialStatus,
      user: null,
      suspension: null,
      revokedReason: null,
    }),
    gate: createGateStore(),
    intents: createIntentStorage(intentStorage),
  };
  const market = createMarketSocket({
    url: socketUrl,
    store,
    getDeviceId,
    getToken: session && (() => session.transport.socketToken()),
    transports,
  });
  const api: ApiClient = createApiClient({
    baseUrl: apiUrl,
    getDeviceId,
    auth: session
      ? createSessionAuth({
          auth: session,
          refreshSession: (body) => api.refreshSession(body),
          // A socket admitted with the old token turned guest when it expired.
          onRenewed: () => {
            reauthenticate(market, store);
          },
        })
      : auth,
  });
  return {
    store,
    api,
    auth: session,
    market,
    storage,
    removals: createRemovalQueue(),
    analytics,
    newId: randomUUID,
  };
}
