import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render } from '@testing-library/react';
import { type ReactElement, type ReactNode } from 'react';

import {
  type AdminOrder,
  type AdminStats,
  type AdminStock,
  type AdminTrading,
  type AdminUser,
  type CustomerRow,
} from '@sarwa/contracts';
import {
  type ApiClient,
  createApiClient,
  type KeyValueStorage,
  createLiveStore,
  createRemovalQueue,
  SarwaProvider,
  type SarwaClient,
} from '@sarwa/core';
import {
  type AdminClient,
  AdminProvider,
  createAdminApi,
  DEFAULT_CIRCUIT_BREAKER,
  DEFAULT_EXECUTION_RULES,
} from '@sarwa/core/admin';

function testClient(): SarwaClient {
  return {
    api: {} as ApiClient,
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
    newId: () => 'test-id',
  };
}

const idleSocket = (): AdminClient['socket'] => ({
  connect: jest.fn(),
  disconnect: jest.fn(),
  onOrder: () => () => undefined,
  onTrading: () => () => undefined,
  onConnect: () => () => undefined,
});

export function testClients(): { sarwa: SarwaClient; admin: AdminClient } {
  return {
    sarwa: testClient(),
    admin: { api: createAdminApi(), socket: idleSocket(), toLogin: jest.fn() },
  };
}

// Pages read copy through useI18n, which needs the Sarwa and Query providers.
export function renderWithProviders(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const client = testClient();
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <SarwaProvider client={client}>{children}</SarwaProvider>
    </QueryClientProvider>
  );
  return render(ui, { wrapper: Wrapper });
}

export interface ApiCall {
  method: string;
  path: string;
  query: URLSearchParams;
  body: unknown;
}
// A reply is a JSON body, an HttpError, or a function of the call returning either.
export type Routes = Record<string, unknown>;

export class HttpError {
  constructor(
    readonly status: number,
    readonly requestId?: string,
  ) {}
}

// A fake server at the fetch boundary: keys look like "GET admin/stocks", and an unrouted call is a 404.
// A string reply is sent as text (a CSV export); an HttpError may carry the server's request id.
export function fakeFetch(routes: Routes) {
  const calls: ApiCall[] = [];
  globalThis.fetch = jest.fn((input: string, init: RequestInit = {}) => {
    const url = new URL(input, 'http://localhost');
    const call: ApiCall = {
      method: init.method ?? 'GET',
      path: url.pathname.replace(/^\/api\/v1\//, ''),
      query: url.searchParams,
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
    };
    calls.push(call);
    const key = `${call.method} ${call.path}`;
    const route = routes[key];
    const reply: unknown =
      route === undefined
        ? new HttpError(404)
        : typeof route === 'function'
          ? (route as (call: ApiCall) => unknown)(call)
          : route;
    const failure = reply instanceof HttpError ? reply : null;
    const status = failure?.status ?? 200;
    return Promise.resolve({
      ok: status < 400,
      status,
      statusText: key,
      headers: { get: (name: string) => (name === 'x-request-id' ? failure?.requestId : null) },
      json: () => Promise.resolve(failure ? null : reply),
      text: () => Promise.resolve(String(reply)),
    } as unknown as Response);
  }) as unknown as typeof fetch;
  return calls;
}

// Real core hooks and API clients over the fake server; only the sockets are stubbed.
export function renderWithApi(
  ui: ReactElement,
  routes: Routes,
  { storage }: { storage?: KeyValueStorage } = {},
) {
  const calls = fakeFetch(routes);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const orderListeners = new Set<(order: AdminOrder) => void>();
  const sarwa: SarwaClient = {
    ...testClient(),
    api: createApiClient({ baseUrl: '', getDeviceId: () => Promise.resolve('device-1') }),
    ...(storage ? { storage } : {}),
  };
  const admin: AdminClient = {
    api: createAdminApi(),
    socket: {
      ...idleSocket(),
      onOrder: (listener) => {
        orderListeners.add(listener);
        return () => {
          orderListeners.delete(listener);
        };
      },
    },
    toLogin: jest.fn(),
  };
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <SarwaProvider client={sarwa}>
        <AdminProvider client={admin}>{children}</AdminProvider>
      </SarwaProvider>
    </QueryClientProvider>
  );
  const pushOrder = (order: AdminOrder) => {
    act(() => {
      orderListeners.forEach((listener) => {
        listener(order);
      });
    });
  };
  return { calls, admin, queryClient, pushOrder, ...render(ui, { wrapper: Wrapper }) };
}

export const me = (role: AdminUser['role'] = 'ADMIN') => ({ user: makeUser({ role }) });

export function makeStats(overrides: Partial<AdminStats> = {}): AdminStats {
  return {
    connectedClients: 1_284,
    activeSubscriptions: 3_410,
    devices: 912,
    watchlistItems: 5_120,
    topWatchlisted: [],
    market: {
      state: 'running',
      volatility: 1.5,
      since: 1_000,
      ticksPerSecond: 218,
      enabledSymbols: 30,
      totalSymbols: 32,
    },
    recentActivity: [],
    ...overrides,
  };
}

export function makeUser(overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    id: 'u1',
    email: 'maya@minitrading.dev',
    name: 'Maya Haddad',
    role: 'ADMIN',
    status: 'active',
    lastActiveAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makeStock(overrides: Partial<AdminStock> = {}): AdminStock {
  return {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    sector: 'tech',
    exchange: 'NASDAQ',
    currency: 'USD',
    basePrice: 230,
    volatility: 1.2,
    marketCap: 3_000_000_000_000,
    peRatio: 31.2,
    isEnabled: true,
    price: 231.5,
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function makeTrading(overrides: Partial<AdminTrading> = {}): AdminTrading {
  return {
    tradingEnabled: true,
    sessionMode: 'calendar',
    session: { phase: 'regular', isOpen: true, opensAt: 0, closesAt: 1_000_000, earlyClose: false },
    rules: { ...DEFAULT_EXECUTION_RULES },
    halts: [],
    upcoming: [],
    updatedAt: 1_000,
    circuitBreaker: { ...DEFAULT_CIRCUIT_BREAKER },
    tripsToday: [],
    changedBy: null,
    changedAt: null,
    ...overrides,
  };
}

export const NOW = Date.UTC(2026, 10, 27, 15);

export function makeCustomer(overrides: Partial<CustomerRow> = {}): CustomerRow {
  return {
    id: 'c1',
    handle: 'ACC-7F2E9C',
    name: 'Sara Hassan',
    email: 'sara.h@example.com',
    status: 'active',
    emailVerified: true,
    signupPlatform: 'web',
    equityCents: 11_019_429,
    allTimeCents: 1_019_429,
    allTimeBps: 1_019,
    openOrders: 3,
    lastActiveAt: NOW - 120_000,
    createdAt: Date.UTC(2026, 9, 2),
    deletionRequestedAt: null,
    ...overrides,
  };
}
