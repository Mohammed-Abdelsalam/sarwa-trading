import { createSarwaClient, type KeyValueStorage, type SarwaClient } from '@sarwa/core';
import { type AdminClient, createAdminApi, createAdminSocket } from '@sarwa/core/admin';
import { safeLocalStorage } from '@sarwa/ui';
import { readCookie, writePreferenceCookie } from '@sarwa/ui/locale-cookie';

// Everything goes through this origin (next.config rewrites), so the session cookie stays same-site.
const origin = () => (typeof window === 'undefined' ? 'http://localhost' : window.location.origin);

const toLogin = () => {
  const next = `${window.location.pathname}${window.location.search}`;
  window.location.replace(`/login?next=${encodeURIComponent(next)}`);
};

// Language and digits are mirrored into a cookie so the server renders the chosen language first;
// a choice saved before the cookie existed is copied over the first time it is read.
export const preferenceStorage: KeyValueStorage = {
  getItem: async (key) => {
    const value = await safeLocalStorage.getItem(key);
    if (value !== null && readCookie(key) === null) writePreferenceCookie(key, value);
    return value;
  },
  setItem: async (key, value) => {
    await safeLocalStorage.setItem(key, value);
    writePreferenceCookie(key, value);
  },
};

export function createBrowserClients(): { sarwa: SarwaClient; admin: AdminClient } {
  const sarwa = createSarwaClient({
    apiUrl: '',
    socketUrl: origin(),
    storage: preferenceStorage,
    randomUUID: () => crypto.randomUUID(),
    transports: ['polling', 'websocket'],
  });
  const admin: AdminClient = {
    api: createAdminApi({ onUnauthorized: toLogin }),
    socket: createAdminSocket({ url: origin(), onUnauthorized: toLogin }),
    toLogin: () => {
      window.location.replace('/login');
    },
  };
  return { sarwa, admin };
}
