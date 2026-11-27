import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import Constants from 'expo-constants';
import { type ReactNode, useEffect, useState } from 'react';
import { AppState, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import {
  SarwaProvider,
  shouldRetry,
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

// A new app version never restores cache shaped by an older contract.
export const persistOptions = {
  persister: createAsyncStoragePersister({ storage: AsyncStorage, key: 'sarwa.query-cache' }),
  buster: Constants.expoConfig?.version ?? '',
  maxAge: CACHE_TTL_MS,
};

onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => {
    setOnline(state.isConnected !== false);
  }),
);

function useAppLifecycle(): { foreground: boolean; online: boolean } {
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const appState = AppState.addEventListener('change', (status) => {
      const active = status === 'active';
      focusManager.setFocused(active);
      setForeground(active);
    });
    const netInfo = NetInfo.addEventListener((state) => {
      setOnline(state.isConnected !== false);
    });
    return () => {
      appState.remove();
      netInfo();
    };
  }, []);

  return { foreground, online };
}

function LiveSync() {
  useMarketConnection(useAppLifecycle());
  useSyncStocksOnChange();
  useTradingEvents();
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
