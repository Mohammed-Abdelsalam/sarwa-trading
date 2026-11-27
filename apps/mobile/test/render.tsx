import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, renderHook, type screen } from '@testing-library/react-native';
import { type ReactElement, type ReactNode, useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { type CustomerUser, type Problem } from '@sarwa/contracts';
import {
  type ApiClient,
  ApiError,
  type ClientAuth,
  createGateStore,
  createIntentStorage,
  createLiveStore,
  createRemovalQueue,
  createSessionStore,
  queryKeys,
  SarwaProvider,
  type SessionStatus,
} from '@sarwa/core';

import { useCopy } from '../src/lib/i18n';

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

// Screens under test get their data from a mocked view-model; the providers only serve copy (en).
const pendingApi = new Proxy({}, { get: () => () => new Promise(() => undefined) }) as ApiClient;

// An API whose listed calls answer and every other call stays pending.
export function mockApi(calls: Partial<ApiClient> = {}): ApiClient {
  return new Proxy(calls, {
    get: (target, name: string) =>
      (target as Record<string, unknown>)[name] ?? (() => new Promise(() => undefined)),
  }) as ApiClient;
}

export function problem(code: Problem['code'], status: number, extra: object = {}): ApiError {
  const body: Problem = { type: 'about:blank', title: code, status, code };
  return new ApiError({ ...body, ...extra }, { ...body, ...extra });
}

export function customer(overrides: Partial<CustomerUser> = {}): CustomerUser {
  return {
    id: 'u_1',
    email: 'sara.h@example.com',
    name: 'Sara Hassan',
    emailVerified: true,
    createdAt: Date.UTC(2026, 9, 1),
    passwordChangedAt: null,
    account: { id: 'a_1', handle: 'ACC-7F2A9C' },
    ...overrides,
  };
}

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => Promise.resolve(values.get(key) ?? null),
    setItem: (key: string, value: string) => {
      values.set(key, value);
      return Promise.resolve();
    },
  };
}

// Customer auth as createSarwaClient wires it, with an in-memory token store.
export function testAuth(status: SessionStatus = 'guest', user: CustomerUser | null = null) {
  const auth: ClientAuth = {
    transport: {
      platform: 'ios',
      headers: () => Promise.resolve({}),
      hasCredentials: () => Promise.resolve(false),
      refreshBody: () => Promise.resolve(null),
      save: jest.fn(() => Promise.resolve()),
      clear: jest.fn(() => Promise.resolve()),
      socketToken: () => Promise.resolve(undefined),
    },
    session: createSessionStore({ status, user, suspension: null, revokedReason: null }),
    gate: createGateStore(),
    intents: createIntentStorage(memoryStorage()),
  };
  return auth;
}

export function testClient(api: ApiClient = pendingApi, auth?: ClientAuth) {
  return {
    api,
    auth,
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
  auth?: ClientAuth;
  locale?: 'en' | 'ar';
  digits?: 'latn' | 'arab';
}

export function Providers({
  children,
  api,
  auth,
  locale = 'en',
  digits = 'latn',
}: ProviderOptions & { children: ReactNode }) {
  const [queryClient] = useState(() => {
    const created = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
        mutations: { gcTime: Infinity },
      },
    });
    // Saved preferences are seeded so copy renders without an async storage read (English by default).
    created.setQueryData(queryKeys.preference('sarwa.locale'), locale);
    created.setQueryData(queryKeys.preference('sarwa.digits'), digits);
    return created;
  });
  const [client] = useState(() => testClient(api, auth));
  return (
    <SafeAreaProvider initialMetrics={METRICS}>
      <QueryClientProvider client={queryClient}>
        <SarwaProvider client={client}>{children}</SarwaProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

export function renderScreen(ui: ReactElement, options: ProviderOptions = {}) {
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

type HostElement = ReturnType<typeof screen.getByText>;

// The nearest direction style above an element is the one that lays out its row.
export function layoutDirection(element: HostElement) {
  for (let node: HostElement | null = element; node; node = node.parent) {
    const style = StyleSheet.flatten(node.props.style as Parameters<typeof StyleSheet.flatten>[0]);
    if (style?.direction) return style.direction;
  }
  return undefined;
}
