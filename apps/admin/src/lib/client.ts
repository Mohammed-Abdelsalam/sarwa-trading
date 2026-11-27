import {
  createApiClient,
  createDeviceIdGetter,
  createLiveStore,
  createMarketSocket,
  createRemovalQueue,
  type KeyValueStorage,
  noopAnalytics,
  type SarwaClient,
} from '@sarwa/core';
import { type AdminClient, createAdminApi, createAdminSocket } from '@sarwa/core/admin';

const browserStorage: KeyValueStorage = {
  getItem: (key) => {
    try {
      return Promise.resolve(window.localStorage.getItem(key));
    } catch {
      return Promise.resolve(null);
    }
  },
  setItem: (key, value) => {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Private mode: preferences last for this visit only.
    }
    return Promise.resolve();
  },
};

// Everything goes through this origin (next.config rewrites), so the session cookie stays same-site.
const origin = () => (typeof window === 'undefined' ? 'http://localhost' : window.location.origin);

const toLogin = () => {
  const next = `${window.location.pathname}${window.location.search}`;
  window.location.replace(`/login?next=${encodeURIComponent(next)}`);
};

export function createBrowserClients(): { sarwa: SarwaClient; admin: AdminClient } {
  const store = createLiveStore();
  const getDeviceId = createDeviceIdGetter(browserStorage, () => crypto.randomUUID());
  const sarwa: SarwaClient = {
    store,
    api: createApiClient({ baseUrl: '', getDeviceId }),
    market: createMarketSocket({
      url: origin(),
      store,
      getDeviceId,
      transports: ['polling', 'websocket'],
    }),
    storage: browserStorage,
    removals: createRemovalQueue(),
    analytics: noopAnalytics,
    newId: () => crypto.randomUUID(),
  };
  const admin: AdminClient = {
    api: createAdminApi({ onUnauthorized: toLogin }),
    socket: createAdminSocket({ url: origin(), onUnauthorized: toLogin }),
    toLogin: () => {
      window.location.replace('/login');
    },
  };
  return { sarwa, admin };
}
