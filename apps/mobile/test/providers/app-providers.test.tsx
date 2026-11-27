import AsyncStorage from '@react-native-async-storage/async-storage';
import { dehydrate, QueryClient } from '@tanstack/react-query';
import {
  persistQueryClientRestore,
  persistQueryClientSave,
} from '@tanstack/react-query-persist-client';

import { DEVICE_SCOPE, meKeys, queryKeys } from '@sarwa/core';

import {
  isForeground,
  isOnline,
  persistOptions,
  shouldPersistQuery,
  switchPersistScope,
} from '../../src/providers/app-providers';

jest.mock('expo-constants', () => ({ expoConfig: { version: '1.4.0' } }));
jest.mock('@react-native-community/netinfo', () =>
  jest.requireActual<object>('@react-native-community/netinfo/jest/netinfo-mock.js'),
);
jest.mock('../../src/lib/client', () => ({ client: {} }));

function persistedKeys(fill: (client: QueryClient) => void) {
  const client = new QueryClient();
  fill(client);
  const keys = dehydrate(client, { shouldDehydrateQuery: shouldPersistQuery }).queries.map(
    (query) => query.queryKey,
  );
  // Each cached query holds a 5-minute gc timer that would outlive the test file.
  client.clear();
  return keys;
}

describe('persistOptions', () => {
  it('drops the cache saved by another app version and expires it with the query gcTime', () => {
    expect(persistOptions.buster).toBe('1.4.0');
    expect(persistOptions.maxAge).toBe(24 * 60 * 60 * 1000);
  });

  it('starts on the guest cache', async () => {
    await persistOptions.persister.restoreClient();

    expect(AsyncStorage.getItem).toHaveBeenCalledWith('sarwa.query-cache.guest');
  });

  it('switches to the signed-in user, and deletes their cache at sign-out', async () => {
    jest.mocked(AsyncStorage.getItem).mockClear();
    await switchPersistScope('u_1');

    expect(AsyncStorage.getItem).toHaveBeenCalledWith('sarwa.query-cache.u_1');

    await switchPersistScope(null);

    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('sarwa.query-cache.u_1');
    expect(AsyncStorage.getItem).toHaveBeenLastCalledWith('sarwa.query-cache.guest');
  });
});

describe('shouldPersistQuery', () => {
  it('saves only the allow-listed first-screen queries', () => {
    const me = meKeys('u_1');
    const keys = persistedKeys((client) => {
      client.setQueryData(queryKeys.stocks, []);
      client.setQueryData(queryKeys.appConfig, { maintenanceMode: false });
      client.setQueryData(queryKeys.tradingStatus, {});
      client.setQueryData(me.watchlist, ['AAPL']);
      client.setQueryData(me.portfolio, {});
      client.setQueryData(queryKeys.candles('AAPL', '1D'), []);
      client.setQueryData(me.equity('1M'), {});
      client.setQueryData(me.orderPages({ filter: 'open' }), {});
      client.setQueryData(me.orders({ filter: 'open' }), {});
      client.setQueryData(me.notifications, {});
      client.setQueryData(['me'], {});
      client.setQueryData(queryKeys.preference('sarwa.locale'), 'ar');
    });

    expect(keys).toEqual([
      queryKeys.stocks,
      queryKeys.appConfig,
      queryKeys.tradingStatus,
      me.watchlist,
      me.portfolio,
    ]);
  });

  it('saves a guest watchlist under the guest cache and restores it', async () => {
    const watchlist = meKeys(DEVICE_SCOPE).watchlist;
    const saved = new QueryClient();
    saved.setQueryData(watchlist, ['AAPL']);
    await switchPersistScope(null);
    jest.useFakeTimers();
    const saving = persistQueryClientSave({ ...persistOptions, queryClient: saved });
    await jest.runAllTimersAsync();
    await saving;
    jest.useRealTimers();
    saved.clear();

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'sarwa.query-cache.guest',
      expect.any(String),
    );
    const restored = new QueryClient();
    await persistQueryClientRestore({ ...persistOptions, queryClient: restored });
    expect(restored.getQueryData(watchlist)).toEqual(['AAPL']);
    restored.clear();
  });

  it('never saves a maintenance flag, so the next launch asks the server again', () => {
    const keys = persistedKeys((client) => {
      client.setQueryData(queryKeys.appConfig, { maintenanceMode: true });
    });

    expect(keys).toEqual([]);
  });
});

describe('app lifecycle', () => {
  it('keeps the socket up while iOS is only inactive', () => {
    expect(isForeground('active')).toBe(true);
    expect(isForeground('inactive')).toBe(true);
    expect(isForeground('background')).toBe(false);
  });

  it('treats a network without internet as offline, and unknown reachability as online', () => {
    expect(isOnline({ isConnected: true, isInternetReachable: null })).toBe(true);
    expect(isOnline({ isConnected: true, isInternetReachable: false })).toBe(false);
    expect(isOnline({ isConnected: false, isInternetReachable: null })).toBe(false);
    expect(isOnline({ isConnected: null, isInternetReachable: null })).toBe(true);
  });
});
