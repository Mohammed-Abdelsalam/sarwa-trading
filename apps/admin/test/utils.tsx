import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { type ReactElement, type ReactNode } from 'react';

import {
  type AdminAccount,
  type AdminStock,
  type AdminTrading,
  type AdminUser,
} from '@sarwa/contracts';
import {
  type ApiClient,
  createLiveStore,
  createRemovalQueue,
  SarwaProvider,
  type SarwaClient,
} from '@sarwa/core';
import { DEFAULT_CIRCUIT_BREAKER, DEFAULT_EXECUTION_RULES } from '@sarwa/core/admin';

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

export function query(data: unknown, overrides: object = {}) {
  return {
    data,
    isPending: false,
    isError: false,
    isFetching: false,
    dataUpdatedAt: 1_000,
    refetch: jest.fn(),
    ...overrides,
  } as never;
}

export function mutation(overrides: object = {}) {
  return {
    mutate: jest.fn(),
    reset: jest.fn(),
    isPending: false,
    isError: false,
    error: null,
    variables: undefined,
    ...overrides,
  } as { mutate: jest.Mock; reset: jest.Mock };
}

export function session(role: AdminUser['role'] = 'ADMIN') {
  const user = makeUser({ role });
  return {
    user,
    isLoading: false,
    isError: false,
    canEdit: role === 'ADMIN',
    isViewer: role === 'VIEWER',
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

export function makeAccount(overrides: Partial<AdminAccount> = {}): AdminAccount {
  return {
    id: 'acc-1',
    handle: 'ACC-00AA11',
    createdAt: 1_000,
    equityCents: 11_019_429,
    cashCents: 5_142_340,
    todayCents: 64_732,
    allTimeCents: 1_019_429,
    allTimeBps: 1_019,
    positions: 8,
    openOrders: 3,
    lastTradeAt: null,
    ...overrides,
  };
}
