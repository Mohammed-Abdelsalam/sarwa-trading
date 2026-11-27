import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { randomUUID } from 'expo-crypto';

import {
  createApiClient,
  createDeviceIdGetter,
  createLiveStore,
  createMarketSocket,
  createRemovalQueue,
  noopAnalytics,
  type SarwaClient,
} from '@sarwa/core';

// Expo Go on a phone can't reach "localhost", so reuse the dev machine's LAN IP from the bundler URL.
function resolveApiUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (configured) return configured;
  const hostUri: string | undefined = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(':')[0] ?? 'localhost';
  return `http://${host}:4000`;
}

export const API_URL = resolveApiUrl();

const store = createLiveStore();
const getDeviceId = createDeviceIdGetter(AsyncStorage, randomUUID);

export const client: SarwaClient = {
  store,
  api: createApiClient({ baseUrl: API_URL, getDeviceId }),
  market: createMarketSocket({ url: API_URL, store, getDeviceId }),
  storage: AsyncStorage,
  removals: createRemovalQueue(),
  analytics: noopAnalytics,
  newId: randomUUID,
};
