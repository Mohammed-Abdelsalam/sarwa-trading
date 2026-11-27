import { noopAnalytics, type AnalyticsProvider } from './analytics';
import { createApiClient, type RequestAuth } from './api';
import { createDeviceIdGetter, type KeyValueStorage } from './device';
import { createMarketSocket, type SocketTransport } from './market-socket';
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
  analytics = noopAnalytics,
}: SarwaClientOptions): SarwaClient {
  const store = createLiveStore();
  const getDeviceId = createDeviceIdGetter(identityStorage, randomUUID);
  return {
    store,
    api: createApiClient({ baseUrl: apiUrl, getDeviceId, auth }),
    market: createMarketSocket({ url: socketUrl, store, getDeviceId, transports }),
    storage,
    removals: createRemovalQueue(),
    analytics,
    newId: randomUUID,
  };
}
