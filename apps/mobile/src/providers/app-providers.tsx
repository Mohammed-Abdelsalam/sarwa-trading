import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { type ReactNode, useEffect } from 'react';
import { AppState, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SarwaProvider, shouldRetry, useSyncStocksOnChange } from '@sarwa/core';

import { client } from '../lib/client';
import { useThemeVars } from '../lib/theme';

const queryClient = new QueryClient({
  defaultOptions: { queries: { gcTime: 24 * 60 * 60 * 1000, retry: shouldRetry } },
});

const persister = createAsyncStoragePersister({ storage: AsyncStorage, key: 'sarwa.query-cache' });

onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => {
    setOnline(state.isConnected !== false);
  }),
);

// The socket lives only while the app is in the foreground and online: no wasted battery or data.
function useRealtimeLifecycle(): void {
  useEffect(() => {
    let foreground = AppState.currentState === 'active';
    let online = true;

    const sync = () => {
      if (foreground && online) {
        client.market.connect();
        return;
      }
      client.market.disconnect();
      if (!online) client.store.getState().setConnection({ status: 'offline' });
    };

    const appState = AppState.addEventListener('change', (status) => {
      foreground = status === 'active';
      focusManager.setFocused(foreground);
      sync();
    });
    const netInfo = NetInfo.addEventListener((state) => {
      online = state.isConnected !== false;
      sync();
    });
    sync();

    return () => {
      appState.remove();
      netInfo();
      client.market.disconnect();
    };
  }, []);
}

function LiveSync() {
  useSyncStocksOnChange();
  return null;
}

export function AppProviders({ children }: { children: ReactNode }) {
  useRealtimeLifecycle();
  const themeVars = useThemeVars();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
          <SarwaProvider client={client}>
            <LiveSync />
            <View style={[{ flex: 1 }, themeVars]} className="bg-bg">
              {children}
            </View>
          </SarwaProvider>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
