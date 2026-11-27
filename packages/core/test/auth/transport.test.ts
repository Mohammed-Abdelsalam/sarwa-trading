import { CLIENT_PLATFORM_HEADER, CSRF_COOKIE, CSRF_HEADER } from '@sarwa/contracts';

import {
  ACCESS_TOKEN_KEY,
  bearerAuth,
  REFRESH_TOKEN_KEY,
  SAVED_USER_KEY,
  webCookieAuth,
} from '../../src/auth/transport';
import { makeUser, memoryTokens } from '../utils';

const USER = makeUser();

describe('webCookieAuth', () => {
  const transport = webCookieAuth({
    readCookie: (name) => (name === CSRF_COOKIE ? 'csrf-1' : null),
  });

  it('sends cookies and echoes the CSRF token on mutations only', async () => {
    expect(transport.credentials).toBe('include');
    await expect(transport.headers({ method: 'GET' })).resolves.toEqual({
      [CLIENT_PLATFORM_HEADER]: 'web',
    });
    await expect(transport.headers({ method: 'post' })).resolves.toEqual({
      [CLIENT_PLATFORM_HEADER]: 'web',
      [CSRF_HEADER]: 'csrf-1',
    });
  });

  it('leaves the CSRF header out when there is no token cookie yet', async () => {
    const fresh = webCookieAuth({ readCookie: () => undefined });
    await expect(fresh.headers({ method: 'POST' })).resolves.toEqual({
      [CLIENT_PLATFORM_HEADER]: 'web',
    });
  });

  it('has no session to restore without the CSRF cookie, which lives exactly as long as one', async () => {
    const guest = webCookieAuth({ readCookie: () => null });
    await expect(guest.hasCredentials()).resolves.toBe(false);
  });

  it('refreshes with the cookie and keeps no token itself', async () => {
    await expect(transport.refreshBody()).resolves.toEqual({});
    await expect(transport.hasCredentials()).resolves.toBe(true);
    await expect(transport.socketToken()).resolves.toBeUndefined();
    await expect(transport.save({ user: USER, accessExpiresAt: 1 })).resolves.toBeUndefined();
    await expect(transport.clear()).resolves.toBeUndefined();
  });
});

describe('bearerAuth', () => {
  it('keeps the signed-in user beside the tokens for an offline launch', async () => {
    const storage = memoryTokens();
    const transport = bearerAuth({ storage, platform: 'ios' });
    await expect(transport.savedUser?.()).resolves.toBeNull();

    await transport.save({ user: USER, accessExpiresAt: 1, accessToken: 'a1', refreshToken: 'r1' });
    await expect(bearerAuth({ storage, platform: 'ios' }).savedUser?.()).resolves.toEqual(USER);

    storage.values.set(SAVED_USER_KEY, '{"id":');
    await expect(transport.savedUser?.()).resolves.toBeNull();

    await transport.clear();
    expect(storage.values.has(SAVED_USER_KEY)).toBe(false);
  });

  it('has nothing to send or renew before sign-in', async () => {
    const transport = bearerAuth({ storage: memoryTokens(), platform: 'ios' });

    await expect(transport.headers({ method: 'GET' })).resolves.toEqual({
      [CLIENT_PLATFORM_HEADER]: 'ios',
    });
    await expect(transport.hasCredentials()).resolves.toBe(false);
    await expect(transport.refreshBody()).resolves.toBeNull();
    await expect(transport.socketToken()).resolves.toBeUndefined();
  });

  it('keeps both tokens, sends the access token and renews with the refresh token', async () => {
    const storage = memoryTokens();
    const transport = bearerAuth({ storage, platform: 'android' });

    await transport.save({ user: USER, accessExpiresAt: 1, accessToken: 'a1', refreshToken: 'r1' });

    await expect(transport.headers({ method: 'POST' })).resolves.toEqual({
      [CLIENT_PLATFORM_HEADER]: 'android',
      Authorization: 'Bearer a1',
    });
    await expect(transport.refreshBody()).resolves.toEqual({ refreshToken: 'r1' });
    await expect(transport.socketToken()).resolves.toBe('a1');
    expect(storage.values.get(ACCESS_TOKEN_KEY)).toBe('a1');
    expect(storage.values.get(REFRESH_TOKEN_KEY)).toBe('r1');
  });

  it('reads the tokens a previous launch stored, and forgets them on clear', async () => {
    const storage = memoryTokens({ [ACCESS_TOKEN_KEY]: 'a0', [REFRESH_TOKEN_KEY]: 'r0' });
    const transport = bearerAuth({ storage, platform: 'ios' });

    await expect(transport.hasCredentials()).resolves.toBe(true);
    await expect(transport.socketToken()).resolves.toBe('a0');

    await transport.clear();

    expect(storage.values.size).toBe(0);
    await expect(transport.headers({ method: 'GET' })).resolves.toEqual({
      [CLIENT_PLATFORM_HEADER]: 'ios',
    });
  });
});
