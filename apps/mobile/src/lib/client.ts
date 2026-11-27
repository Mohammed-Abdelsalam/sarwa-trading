import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { randomUUID } from 'expo-crypto';

import { bearerAuth, createSarwaClient, type SarwaClient } from '@sarwa/core';

import { resolveApiUrl } from './api-url';
import { devicePlatform } from './device';
import { createSecureStorage } from './secure-storage';

export const API_URL = resolveApiUrl({
  configured: process.env.EXPO_PUBLIC_API_URL,
  hostUri: Constants.expoConfig?.hostUri,
  dev: __DEV__,
});

export const client: SarwaClient = createSarwaClient({
  apiUrl: API_URL,
  storage: AsyncStorage,
  // The device id still names a guest's paper account, so it lives in the keychain too.
  identityStorage: createSecureStorage(AsyncStorage),
  authTransport: bearerAuth({ storage: createSecureStorage(), platform: devicePlatform() }),
  randomUUID,
});
