import { DEVICE_ID_HEADER } from '@sarwa/contracts';

import { createSarwaClient } from '../src/client';
import { createMemoryStorage } from './utils';

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
});
