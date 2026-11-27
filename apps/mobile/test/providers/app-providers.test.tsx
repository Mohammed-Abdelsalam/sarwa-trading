import { dehydrate, QueryClient } from '@tanstack/react-query';

import { queryKeys } from '@sarwa/core';

import {
  isForeground,
  isOnline,
  persistOptions,
  shouldPersistQuery,
} from '../../src/providers/app-providers';

jest.mock('expo-constants', () => ({ expoConfig: { version: '1.4.0' } }));
jest.mock('@react-native-community/netinfo', () =>
  jest.requireActual<object>('@react-native-community/netinfo/jest/netinfo-mock.js'),
);
jest.mock('../../src/lib/client', () => ({ client: {} }));

function persistedKeys(fill: (client: QueryClient) => void) {
  const client = new QueryClient();
  fill(client);
  return dehydrate(client, { shouldDehydrateQuery: shouldPersistQuery }).queries.map(
    (query) => query.queryKey,
  );
}

describe('persistOptions', () => {
  it('drops the cache saved by another app version and expires it with the query gcTime', () => {
    expect(persistOptions.buster).toBe('1.4.0');
    expect(persistOptions.maxAge).toBe(24 * 60 * 60 * 1000);
  });
});

describe('shouldPersistQuery', () => {
  it('saves only the allow-listed first-screen queries', () => {
    const keys = persistedKeys((client) => {
      client.setQueryData(queryKeys.stocks, []);
      client.setQueryData(queryKeys.appConfig, { maintenanceMode: false });
      client.setQueryData(queryKeys.tradingStatus, {});
      client.setQueryData(queryKeys.watchlist, ['AAPL']);
      client.setQueryData(queryKeys.portfolio, {});
      client.setQueryData(queryKeys.candles('AAPL', '1D'), []);
      client.setQueryData(queryKeys.equity('1M'), {});
      client.setQueryData(queryKeys.orderPages({ filter: 'open' }), {});
      client.setQueryData(queryKeys.orders({ filter: 'open' }), {});
      client.setQueryData(queryKeys.notifications, {});
      client.setQueryData(queryKeys.preference('sarwa.locale'), 'ar');
    });

    expect(keys).toEqual([
      queryKeys.stocks,
      queryKeys.appConfig,
      queryKeys.tradingStatus,
      queryKeys.watchlist,
      queryKeys.portfolio,
    ]);
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
