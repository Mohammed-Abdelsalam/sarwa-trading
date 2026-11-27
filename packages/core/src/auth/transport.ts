import {
  type AuthSessionResponse,
  type ClientPlatform,
  CLIENT_PLATFORM_HEADER,
  type CustomerUser,
  CustomerUserSchema,
  CSRF_COOKIE,
  CSRF_HEADER,
  type RefreshRequest,
} from '@sarwa/contracts';

import { type KeyValueStorage } from '../device';

// How a signed-in session travels: cookies on the web, a bearer token on mobile.
export interface AuthTransport {
  readonly platform: ClientPlatform;
  readonly credentials?: RequestCredentials;
  headers(request: { method: string }): Promise<Record<string, string>>;
  // Whether a session might exist, so a fresh guest skips the `me` round trip.
  hasCredentials(): Promise<boolean>;
  // What POST auth/refresh carries; null when there is nothing to renew with.
  refreshBody(): Promise<RefreshRequest | null>;
  save(session: AuthSessionResponse): Promise<void>;
  clear(): Promise<void>;
  // The web handshake sends the access cookie instead.
  socketToken(): Promise<string | undefined>;
  // Who signed in last, so a launch without network can still open their cached data.
  savedUser?(): Promise<CustomerUser | null>;
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// The cookies are httpOnly and set by the server; only the CSRF token is readable, to echo it back.
export function webCookieAuth({
  readCookie,
}: {
  readCookie: (name: string) => string | null | undefined;
}): AuthTransport {
  const none = () => Promise.resolve();
  return {
    platform: 'web',
    credentials: 'include',
    headers: ({ method }) => {
      const csrf = SAFE_METHODS.has(method.toUpperCase()) ? null : readCookie(CSRF_COOKIE);
      return Promise.resolve({
        [CLIENT_PLATFORM_HEADER]: 'web',
        ...(csrf && { [CSRF_HEADER]: csrf }),
      });
    },
    // The CSRF cookie is set and cleared with the session, so without it a guest skips `me` and refresh.
    hasCredentials: () => Promise.resolve(Boolean(readCookie(CSRF_COOKIE))),
    refreshBody: () => Promise.resolve({}),
    save: none,
    clear: none,
    socketToken: () => Promise.resolve(undefined),
  };
}

export interface TokenStorage extends KeyValueStorage {
  removeItem(key: string): Promise<void>;
}

export const ACCESS_TOKEN_KEY = 'sarwa.accessToken';
export const REFRESH_TOKEN_KEY = 'sarwa.refreshToken';
export const SAVED_USER_KEY = 'sarwa.user';

function parseUser(raw: string | null): CustomerUser | null {
  if (!raw) return null;
  try {
    return CustomerUserSchema.safeParse(JSON.parse(raw)).data ?? null;
  } catch {
    return null;
  }
}

// Mobile keeps both tokens (and the signed-in user) in SecureStore; the access token is also held in memory for each call.
export function bearerAuth({
  storage,
  platform,
}: {
  storage: TokenStorage;
  platform: Exclude<ClientPlatform, 'web'>;
}): AuthTransport {
  let access: Promise<string | null> | undefined;
  const accessToken = () => (access ??= storage.getItem(ACCESS_TOKEN_KEY));
  return {
    platform,
    headers: async () => {
      const token = await accessToken();
      return {
        [CLIENT_PLATFORM_HEADER]: platform,
        ...(token && { Authorization: `Bearer ${token}` }),
      };
    },
    hasCredentials: async () => (await storage.getItem(REFRESH_TOKEN_KEY)) !== null,
    refreshBody: async () => {
      const refreshToken = await storage.getItem(REFRESH_TOKEN_KEY);
      return refreshToken ? { refreshToken } : null;
    },
    save: async ({ accessToken: nextAccess, refreshToken, user }) => {
      if (nextAccess) {
        access = Promise.resolve(nextAccess);
        await storage.setItem(ACCESS_TOKEN_KEY, nextAccess);
      }
      if (refreshToken) await storage.setItem(REFRESH_TOKEN_KEY, refreshToken);
      await storage.setItem(SAVED_USER_KEY, JSON.stringify(user));
    },
    clear: async () => {
      access = Promise.resolve(null);
      await Promise.all(
        [ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, SAVED_USER_KEY].map((key) => storage.removeItem(key)),
      );
    },
    socketToken: async () => (await accessToken()) ?? undefined,
    savedUser: async () => parseUser(await storage.getItem(SAVED_USER_KEY)),
  };
}
