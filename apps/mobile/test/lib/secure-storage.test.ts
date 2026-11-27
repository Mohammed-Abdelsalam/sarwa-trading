import * as SecureStore from 'expo-secure-store';

import { createDeviceIdGetter, type KeyValueStorage } from '@sarwa/core';

import { createSecureStorage } from '../../src/lib/secure-storage';

jest.mock('expo-secure-store', () => {
  const values = new Map<string, string>();
  return {
    AFTER_FIRST_UNLOCK: 'after-first-unlock',
    getItemAsync: jest.fn((key: string) => Promise.resolve(values.get(key) ?? null)),
    setItemAsync: jest.fn((key: string, value: string) => {
      values.set(key, value);
      return Promise.resolve();
    }),
    reset: () => {
      values.clear();
    },
  };
});

const keychain = SecureStore as typeof SecureStore & { reset: () => void };

function memoryStorage(entries: Record<string, string> = {}): KeyValueStorage {
  const values = new Map(Object.entries(entries));
  return {
    getItem: (key) => Promise.resolve(values.get(key) ?? null),
    setItem: (key, value) => {
      values.set(key, value);
      return Promise.resolve();
    },
  };
}

beforeEach(() => {
  keychain.reset();
  jest.clearAllMocks();
});

describe('createSecureStorage', () => {
  it('keeps values in the keychain, readable after the first unlock', async () => {
    const storage = createSecureStorage();
    await storage.setItem('sarwa.deviceId', 'device-1');

    expect(await storage.getItem('sarwa.deviceId')).toBe('device-1');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('sarwa.deviceId', 'device-1', {
      keychainAccessible: 'after-first-unlock',
    });
  });

  it('returns null for a key it never saw', async () => {
    expect(await createSecureStorage(memoryStorage()).getItem('sarwa.deviceId')).toBeNull();
  });

  it('moves a value an older build left in plain storage into the keychain', async () => {
    const storage = createSecureStorage(memoryStorage({ 'sarwa.deviceId': 'old-device' }));

    expect(await storage.getItem('sarwa.deviceId')).toBe('old-device');
    expect(await createSecureStorage().getItem('sarwa.deviceId')).toBe('old-device');
  });

  it('keeps the same device id across launches through core', async () => {
    const first = createDeviceIdGetter(createSecureStorage(), () => 'device-1');
    const second = createDeviceIdGetter(createSecureStorage(), () => 'device-2');

    expect(await first()).toBe('device-1');
    expect(await second()).toBe('device-1');
  });
});
