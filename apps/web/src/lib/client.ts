import {
  createApiClient,
  createDeviceIdGetter,
  createLiveStore,
  createMarketSocket,
  createRemovalQueue,
  type KeyValueStorage,
  type SarwaClient,
} from '@sarwa/core';

import { API_URL } from './api-url';

const browserStorage: KeyValueStorage = {
  getItem: (key) => Promise.resolve(window.localStorage.getItem(key)),
  setItem: (key, value) => {
    window.localStorage.setItem(key, value);
    return Promise.resolve();
  },
};

export function createBrowserClient(): SarwaClient {
  const store = createLiveStore();
  return {
    store,
    api: createApiClient({
      baseUrl: API_URL,
      getDeviceId: createDeviceIdGetter(browserStorage, () => crypto.randomUUID()),
    }),
    market: createMarketSocket({ url: API_URL, store }),
    storage: browserStorage,
    removals: createRemovalQueue(),
  };
}
