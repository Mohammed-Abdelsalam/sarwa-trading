import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { randomUUID } from 'expo-crypto';

import { createSarwaClient, type SarwaClient } from '@sarwa/core';

import { resolveApiUrl } from './api-url';
import { createSecureStorage } from './secure-storage';

export const API_URL = resolveApiUrl({
  configured: process.env.EXPO_PUBLIC_API_URL,
  hostUri: Constants.expoConfig?.hostUri,
  dev: __DEV__,
});

export const client: SarwaClient = createSarwaClient({
  apiUrl: API_URL,
  storage: AsyncStorage,
  // The device id is the account's only credential until sign-in exists, so it lives in the keychain.
  identityStorage: createSecureStorage(AsyncStorage),
  randomUUID,
});
