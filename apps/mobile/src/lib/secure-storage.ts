import * as SecureStore from 'expo-secure-store';

import { type KeyValueStorage, type TokenStorage } from '@sarwa/core';

// Readable after the first unlock so a background reconnect can still identify the device.
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

// A key an older build kept in plain storage moves into the keychain on its first read.
export function createSecureStorage(legacy?: KeyValueStorage): TokenStorage {
  return {
    async getItem(key) {
      const value = await SecureStore.getItemAsync(key, OPTIONS);
      if (value !== null || !legacy) return value;
      const previous = await legacy.getItem(key);
      if (previous !== null) await SecureStore.setItemAsync(key, previous, OPTIONS);
      return previous;
    },
    setItem: (key, value) => SecureStore.setItemAsync(key, value, OPTIONS),
    removeItem: (key) => SecureStore.deleteItemAsync(key, OPTIONS),
  };
}
