import { persistOptions } from '../../src/providers/app-providers';

jest.mock('expo-constants', () => ({ expoConfig: { version: '1.4.0' } }));
jest.mock('@react-native-community/netinfo', () =>
  jest.requireActual<object>('@react-native-community/netinfo/jest/netinfo-mock.js'),
);
jest.mock('../../src/lib/client', () => ({ client: {} }));

describe('persistOptions', () => {
  it('drops the cache saved by another app version and expires it with the query gcTime', () => {
    expect(persistOptions.buster).toBe('1.4.0');
    expect(persistOptions.maxAge).toBe(24 * 60 * 60 * 1000);
  });
});
