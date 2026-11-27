import { CLIENT_PLATFORM_HEADER, DEVICE_ID_HEADER } from '@sarwa/contracts';

import { bearerAuth, webCookieAuth } from '../src/auth/transport';
import { createSarwaClient } from '../src/client';
import { createMemoryStorage, makeUser, memoryTokens } from './utils';

describe('createSarwaClient', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('wires the API to the stored device id and hands out ids from the given source', async () => {
    const fetchMock = jest.fn((_url: string, _init: RequestInit) =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ symbols: [] }) }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const storage = createMemoryStorage({ 'sarwa.deviceId': 'device-1' });
    const client = createSarwaClient({
      apiUrl: 'http://api',
      storage,
      randomUUID: () => 'new-id',
      transports: ['polling'],
    });

    await client.api.getWatchlist();

    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://api/api/v1/watchlist');
    expect(fetchMock.mock.calls[0]?.[1].headers).toMatchObject({ [DEVICE_ID_HEADER]: 'device-1' });
    expect(client.newId()).toBe('new-id');
    expect(client.storage).toBe(storage);
    client.market.disconnect();
  });

  it('can keep the device identity in a separate, more protected store', async () => {
    const fetchMock = jest.fn((_url: string, _init: RequestInit) =>
      Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ symbols: [] }) }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const storage = createMemoryStorage({ 'sarwa.deviceId': 'plain-device' });
    const identityStorage = createMemoryStorage({ 'sarwa.deviceId': 'secure-device' });
    const client = createSarwaClient({
      apiUrl: 'http://api',
      storage,
      identityStorage,
      randomUUID: () => 'new-id',
      transports: ['polling'],
    });

    await client.api.getWatchlist();

    expect(fetchMock.mock.calls[0]?.[1].headers).toMatchObject({
      [DEVICE_ID_HEADER]: 'secure-device',
    });
    expect(client.storage).toBe(storage);
    client.market.disconnect();
  });

  it('has no customer auth unless a transport is given', () => {
    const client = createSarwaClient({
      apiUrl: 'http://api',
      storage: createMemoryStorage(),
      randomUUID: () => 'new-id',
    });
    expect(client.auth).toBeUndefined();
  });

  it('starts the session loading, or as a guest when the server already knows there is none', () => {
    const create = (initialStatus?: 'loading' | 'guest') =>
      createSarwaClient({
        apiUrl: 'http://api',
        storage: createMemoryStorage(),
        randomUUID: () => 'new-id',
        authTransport: webCookieAuth({ readCookie: () => null }),
        initialStatus,
      });

    expect(create().auth?.session.getState().status).toBe('loading');
    expect(create('loading').auth?.session.getState().status).toBe('loading');
    expect(create('guest').auth?.session.getState()).toMatchObject({
      status: 'guest',
      user: null,
      revokedReason: null,
    });
  });

  it('renews an expired bearer session once and resends with the new token', async () => {
    const user = makeUser();
    const calls: { path: string; auth?: string; body?: string }[] = [];
    global.fetch = jest.fn((url: string, init: RequestInit) => {
      const path = url.replace('http://api/api/v1', '');
      const headers = init.headers as Record<string, string>;
      calls.push({ path, auth: headers.Authorization, body: init.body as string | undefined });
      expect(headers[CLIENT_PLATFORM_HEADER]).toBe('ios');
      if (path === '/auth/refresh') {
        const rotated = { user, accessExpiresAt: 1, accessToken: 'a2', refreshToken: 'r2' };
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(rotated) });
      }
      const expired = headers.Authorization === 'Bearer a1';
      return Promise.resolve({
        ok: !expired,
        status: expired ? 401 : 200,
        json: () => Promise.resolve(expired ? null : { symbols: ['AAPL'] }),
      });
    }) as unknown as typeof fetch;
    const tokens = memoryTokens({ 'sarwa.accessToken': 'a1', 'sarwa.refreshToken': 'r1' });
    const client = createSarwaClient({
      apiUrl: 'http://api',
      storage: createMemoryStorage(),
      randomUUID: () => 'new-id',
      authTransport: bearerAuth({ storage: tokens, platform: 'ios' }),
    });
    client.auth?.session.getState().signIn(user);

    const [first, second] = await Promise.all([
      client.api.getWatchlist(),
      client.api.getWatchlist(),
    ]);

    expect(first).toEqual({ symbols: ['AAPL'] });
    expect(second).toEqual({ symbols: ['AAPL'] });
    expect(calls.filter((call) => call.path === '/auth/refresh')).toEqual([
      { path: '/auth/refresh', auth: 'Bearer a1', body: '{"refreshToken":"r1"}' },
    ]);
    expect(calls.slice(-2).map((call) => call.auth)).toEqual(['Bearer a2', 'Bearer a2']);
    expect(tokens.values.get('sarwa.refreshToken')).toBe('r2');
    expect(client.auth?.session.getState().status).toBe('authenticated');
    client.market.disconnect();
  });

  it('rejoins a live socket once per renewal, so its handshake carries the new token', async () => {
    const user = makeUser();
    global.fetch = jest.fn((url: string, init: RequestInit) => {
      const headers = init.headers as Record<string, string>;
      if (url.endsWith('/auth/refresh')) {
        const rotated = { user, accessExpiresAt: 1, accessToken: 'a2', refreshToken: 'r2' };
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(rotated) });
      }
      const expired = headers.Authorization === 'Bearer a1';
      return Promise.resolve({
        ok: !expired,
        status: expired ? 401 : 200,
        json: () => Promise.resolve(expired ? null : { symbols: [] }),
      });
    }) as unknown as typeof fetch;
    const client = createSarwaClient({
      apiUrl: 'http://api',
      storage: createMemoryStorage(),
      randomUUID: () => 'new-id',
      authTransport: bearerAuth({
        storage: memoryTokens({ 'sarwa.accessToken': 'a1', 'sarwa.refreshToken': 'r1' }),
        platform: 'ios',
      }),
    });
    client.auth?.session.getState().signIn(user);
    client.store.getState().setConnection({ status: 'open' });
    const order: string[] = [];
    const disconnect = jest.spyOn(client.market, 'disconnect').mockImplementation(() => {
      order.push('disconnect');
    });
    const connect = jest.spyOn(client.market, 'connect').mockImplementation(() => {
      order.push('connect');
    });

    await Promise.all([client.api.getWatchlist(), client.api.getWatchlist()]);

    expect(order).toEqual(['disconnect', 'connect']);
    await expect(client.auth?.transport.socketToken()).resolves.toBe('a2');

    await client.api.getWatchlist();
    expect(connect).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
