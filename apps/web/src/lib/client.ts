import { createSarwaClient, type KeyValueStorage, type SarwaClient } from '@sarwa/core';
import { safeLocalStorage } from '@sarwa/ui';

import { API_URL } from './api-url';
import { writePreferenceCookie } from './locale-cookie';

// Preferences are mirrored into a cookie so the server renders the chosen language first time.
const browserStorage: KeyValueStorage = {
  getItem: (key) => safeLocalStorage.getItem(key),
  setItem: async (key, value) => {
    await safeLocalStorage.setItem(key, value);
    writePreferenceCookie(key, value);
  },
};

export function createBrowserClient(): SarwaClient {
  return createSarwaClient({
    apiUrl: API_URL,
    storage: browserStorage,
    randomUUID: () => crypto.randomUUID(),
  });
}
