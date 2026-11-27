import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, renderHook } from '@testing-library/react-native';
import { type ReactElement, type ReactNode, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import {
  type ApiClient,
  createLiveStore,
  createRemovalQueue,
  queryKeys,
  SarwaProvider,
} from '@sarwa/core';

import { useCopy } from '../src/lib/i18n';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

// Screens under test get their data from a mocked view-model; the providers only serve copy (en).
const pendingApi = new Proxy({}, { get: () => () => new Promise(() => undefined) }) as ApiClient;

export function testClient(api: ApiClient = pendingApi) {
  return {
    api,
    store: createLiveStore(),
    market: {
      connect: jest.fn(),
      disconnect: jest.fn(),
      acquire: jest.fn(() => jest.fn()),
      subscribedSymbols: () => [],
      onTradingEvent: () => () => undefined,
    },
    storage: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
    removals: createRemovalQueue(),
    analytics: { track: jest.fn() },
    newId: () => 'test-idempotency-key',
  };
}

export interface ProviderOptions {
  api?: ApiClient;
  locale?: 'en' | 'ar';
  digits?: 'latn' | 'arab';
}

export function Providers({
  children,
  api,
  locale = 'en',
  digits = 'latn',
}: ProviderOptions & { children: ReactNode }) {
  const [queryClient] = useState(() => {
    const created = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    // Saved preferences are seeded so copy renders without an async storage read (English by default).
    created.setQueryData(queryKeys.preference('sarwa.locale'), locale);
    created.setQueryData(queryKeys.preference('sarwa.digits'), digits);
    return created;
  });
  const [client] = useState(() => testClient(api));
  return (
    <SafeAreaProvider initialMetrics={METRICS}>
      <QueryClientProvider client={queryClient}>
        <SarwaProvider client={client}>{children}</SarwaProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

export function renderScreen(ui: ReactElement, options: Omit<ProviderOptions, 'api'> = {}) {
  return render(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <Providers {...options}>{children}</Providers>
    ),
  });
}

export async function englishCopy() {
  const { result } = await renderHook(() => useCopy(), { wrapper: Providers });
  return result.current;
}
