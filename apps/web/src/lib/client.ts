import {
  createApiClient,
  createDeviceIdGetter,
  createLiveStore,
  createMarketSocket,
  createRemovalQueue,
  noopAnalytics,
  type KeyValueStorage,
  type SarwaClient,
} from '@sarwa/core';

import { API_URL } from './api-url';
import { writePreferenceCookie } from './locale-cookie';

const browserStorage: KeyValueStorage = {
  getItem: (key) => Promise.resolve(window.localStorage.getItem(key)),
  setItem: (key, value) => {
    window.localStorage.setItem(key, value);
    writePreferenceCookie(key, value);
    return Promise.resolve();
  },
};

export function createBrowserClient(): SarwaClient {
  const store = createLiveStore();
  const getDeviceId = createDeviceIdGetter(browserStorage, () => crypto.randomUUID());
  return {
    store,
    api: createApiClient({ baseUrl: API_URL, getDeviceId }),
    market: createMarketSocket({ url: API_URL, store, getDeviceId }),
    storage: browserStorage,
    removals: createRemovalQueue(),
    analytics: noopAnalytics,
    newId: () => crypto.randomUUID(),
  };
}
