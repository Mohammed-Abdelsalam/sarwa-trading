import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import {
  defaultShouldDehydrateQuery,
  focusManager,
  hashKey,
  onlineManager,
  type Query,
  QueryClient,
} from '@tanstack/react-query';
import {
  type Persister,
  persistQueryClientRestore,
  PersistQueryClientProvider,
} from '@tanstack/react-query-persist-client';
import Constants from 'expo-constants';
import { type ReactNode, useEffect, useState, useSyncExternalStore } from 'react';
import { AppState, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { type AppConfig } from '@sarwa/contracts';
import {
  type Locale,
  ME_SCOPE,
  meKeys,
  queryKeys,
  SarwaProvider,
  shouldRetry,
  useAuthSync,
  useI18n,
  useMarketConnection,
  useSyncStocksOnChange,
  useTradingEvents,
  useTradingStatus,
} from '@sarwa/core';

import { client } from '../lib/client';
import { useThemeVars } from '../lib/theme';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const queryClient = new QueryClient({
  defaultOptions: { queries: { gcTime: CACHE_TTL_MS, retry: shouldRetry } },
});

// For screens rendered outside the providers (the root error boundary): the language already read.
export function savedLocale(): Locale {
  return queryClient.getQueryData(queryKeys.preference('sarwa.locale')) === 'ar' ? 'ar' : 'en';
}

// Only what paints the first screens offline; candles, order pages and notifications refetch.
const PUBLIC_PERSISTED = new Set(
  [queryKeys.stocks, queryKeys.appConfig, queryKeys.tradingStatus].map((key) => hashKey(key)),
);

function isPersisted(query: Query): boolean {
  if (PUBLIC_PERSISTED.has(query.queryHash)) return true;
  const [scope, userId] = query.queryKey;
  if (scope !== ME_SCOPE[0] || typeof userId !== 'string') return false;
  const keys = meKeys(userId);
  return [keys.watchlist, keys.portfolio].some((key) => hashKey(key) === query.queryHash);
}

export function shouldPersistQuery(query: Query): boolean {
  if (!defaultShouldDehydrateQuery(query) || !isPersisted(query)) return false;
  // A saved maintenance flag would lock the next launch before the app could ask again.
  return (
    query.queryHash !== hashKey(queryKeys.appConfig) ||
    !(query.state.data as AppConfig).maintenanceMode
  );
}

export const GUEST_SCOPE = 'guest';

// The scope keeps one identity's cache from being restored for another.
// A new app version never restores cache shaped by an older contract.
export function createPersistOptions(scope: string) {
  return {
    persister: createAsyncStoragePersister({
      storage: AsyncStorage,
      key: `sarwa.query-cache.${scope}`,
    }),
    buster: Constants.expoConfig?.version ?? '',
    maxAge: CACHE_TTL_MS,
    dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
  };
}

let active = createPersistOptions(GUEST_SCOPE);

// The provider subscribes once, so its persister follows whichever identity is signed in.
const scopedPersister: Persister = {
  persistClient: (persisted) => active.persister.persistClient(persisted),
  restoreClient: () => active.persister.restoreClient(),
  removeClient: () => active.persister.removeClient(),
};

export const persistOptions = { ...active, persister: scopedPersister };

// Sign-in restores that user's saved cache; sign-out deletes it so the phone keeps no portfolio.
export async function switchPersistScope(userId: string | null): Promise<void> {
  const leaving = active;
  active = createPersistOptions(userId ?? GUEST_SCOPE);
  if (userId === null) await leaving.persister.removeClient();
  await persistQueryClientRestore({ ...persistOptions, queryClient });
}

// Wi-Fi without internet (captive portal, dead hotspot) counts as offline; unknown reachability does not.
export function isOnline(state: {
  isConnected: boolean | null;
  isInternetReachable?: boolean | null;
}) {
  return state.isConnected !== false && state.isInternetReachable !== false;
}

// iOS reports 'inactive' for the app switcher, a call or Control Center; only 'background' pauses the socket.
export const isForeground = (status: string | null | undefined) => status !== 'background';

// The one NetInfo subscription: queries and the socket both follow the query client's online state.
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => {
    setOnline(isOnline(state));
  }),
);

function useAppLifecycle(): { foreground: boolean; online: boolean } {
  const [foreground, setForeground] = useState(isForeground(AppState.currentState));
  const online = useSyncExternalStore(onlineManager.subscribe.bind(onlineManager), () =>
    onlineManager.isOnline(),
  );

  useEffect(() => {
    const appState = AppState.addEventListener('change', (status) => {
      focusManager.setFocused(status === 'active');
      setForeground(isForeground(status));
    });
    return () => {
      appState.remove();
    };
  }, []);

  return { foreground, online };
}

function onIdentityChange(userId: string | null) {
  void switchPersistScope(userId);
}

function LiveSync() {
  useMarketConnection(useAppLifecycle());
  useSyncStocksOnChange();
  useTradingEvents();
  useAuthSync({ onIdentityChange });
  // Fetched at boot so the order ticket rarely has to wait for the trading rules.
  useTradingStatus();
  return null;
}

// RN has no dir attribute: a direction style at the root flips every row and start/end below it.
function Directional({ children }: { children: ReactNode }) {
  const themeVars = useThemeVars();
  const { dir } = useI18n();
  return (
    <View style={[{ flex: 1, direction: dir }, themeVars]} className="bg-bg">
      {children}
    </View>
  );
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
          <SarwaProvider client={client}>
            <LiveSync />
            <Directional>{children}</Directional>
          </SarwaProvider>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
