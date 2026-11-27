import { createSarwaClient, type SarwaClient } from '@sarwa/core';
import { type AdminClient, createAdminApi, createAdminSocket } from '@sarwa/core/admin';
import { safeLocalStorage } from '@sarwa/ui';

// Everything goes through this origin (next.config rewrites), so the session cookie stays same-site.
const origin = () => (typeof window === 'undefined' ? 'http://localhost' : window.location.origin);

const toLogin = () => {
  const next = `${window.location.pathname}${window.location.search}`;
  window.location.replace(`/login?next=${encodeURIComponent(next)}`);
};

export function createBrowserClients(): { sarwa: SarwaClient; admin: AdminClient } {
  const sarwa = createSarwaClient({
    apiUrl: '',
    socketUrl: origin(),
    storage: safeLocalStorage,
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
