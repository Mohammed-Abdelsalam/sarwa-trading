import {
  createSarwaClient,
  type KeyValueStorage,
  type SarwaClient,
  type SarwaClientOptions,
  webCookieAuth,
} from '@sarwa/core';
import { safeLocalStorage } from '@sarwa/ui';
import { readCookie, writePreferenceCookie } from '@sarwa/ui/locale-cookie';

import { API_URL } from './api-url';

// Preferences are mirrored into a cookie so the server renders the chosen language first time.
const browserStorage: KeyValueStorage = {
  getItem: (key) => safeLocalStorage.getItem(key),
  setItem: async (key, value) => {
    await safeLocalStorage.setItem(key, value);
    writePreferenceCookie(key, value);
  },
};

// A gated action waits only for this tab; blocked storage (private mode) just forgets it.
export const tabStorage: KeyValueStorage = {
  getItem: (key) => {
    try {
      return Promise.resolve(window.sessionStorage.getItem(key));
    } catch {
      return Promise.resolve(null);
    }
  },
  setItem: (key, value) => {
    try {
      window.sessionStorage.setItem(key, value);
    } catch {
      // Nothing to keep it in; the guest simply lands where they signed in.
    }
    return Promise.resolve();
  },
};

// The API and socket go through this origin (next.config rewrites), so the session cookies stay
// first-party and SameSite=Lax holds.
export function createBrowserClient(
  initialStatus: SarwaClientOptions['initialStatus'] = 'loading',
): SarwaClient {
  return createSarwaClient({
    apiUrl: '',
    socketUrl: typeof window === 'undefined' ? API_URL : window.location.origin,
    storage: browserStorage,
    randomUUID: () => crypto.randomUUID(),
    transports: ['polling', 'websocket'],
    authTransport: webCookieAuth({ readCookie }),
    intentStorage: tabStorage,
    initialStatus,
  });
}
