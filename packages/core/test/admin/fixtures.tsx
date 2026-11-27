import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';

import {
  type AdminAccount,
  type AdminOrder,
  type AdminStock,
  type AdminTrading,
  type AdminUser,
  type AppConfig,
  PERIODS,
} from '@sarwa/contracts';
import { DEFAULT_CIRCUIT_BREAKER } from '@sarwa/domain';

import { type AdminApi } from '../../src/admin/api';
import { type AdminClient, AdminProvider } from '../../src/admin/provider';
import { type AdminSocket } from '../../src/admin/socket';
import { SarwaProvider, type SarwaClient } from '../../src/provider';
import { makeOrder, makeTradingStatus } from '../trading-fixtures';
import { createTestClient } from '../utils';

export function makeAdminUser(overrides: Partial<AdminUser> = {}): AdminUser {
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

export function makeAdminStock(overrides: Partial<AdminStock> = {}): AdminStock {
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

export function makeAdminOrder(overrides: Partial<AdminOrder> = {}): AdminOrder {
  return { ...makeOrder(), accountHandle: 'ACC-00AA11', latencyMs: 12, ...overrides };
}

export function makeAdminTrading(overrides: Partial<AdminTrading> = {}): AdminTrading {
  return {
    ...makeTradingStatus(),
    circuitBreaker: { ...DEFAULT_CIRCUIT_BREAKER, enabled: true },
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
    equityCents: 10_000_000,
    cashCents: 5_000_000,
    todayCents: 0,
    allTimeCents: 0,
    allTimeBps: 0,
    positions: 0,
    openOrders: 0,
    lastTradeAt: null,
    ...overrides,
  };
}

export function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    maintenanceMode: false,
    banner: null,
    enabledPeriods: [...PERIODS],
    updatedAt: 1,
    ...overrides,
  };
}

export interface FakeAdminSocket extends AdminSocket {
  order(order: AdminOrder): void;
  trading(trading: AdminTrading): void;
}

export function fakeAdminSocket(): FakeAdminSocket {
  const orders = new Set<(order: AdminOrder) => void>();
  const tradings = new Set<(trading: AdminTrading) => void>();
  return {
    connect: jest.fn(),
    disconnect: jest.fn(),
    onOrder: (listener) => {
      orders.add(listener);
      return () => orders.delete(listener);
    },
    onTrading: (listener) => {
      tradings.add(listener);
      return () => tradings.delete(listener);
    },
    order: (order) => {
      orders.forEach((listener) => {
        listener(order);
      });
    },
    trading: (trading) => {
      tradings.forEach((listener) => {
        listener(trading);
      });
    },
  };
}

export function createAdminWrapper(
  api: Partial<AdminApi>,
  { sarwa = createTestClient() }: { sarwa?: SarwaClient } = {},
) {
  const socket = fakeAdminSocket();
  const client: AdminClient = { api: api as AdminApi, socket, toLogin: jest.fn() };
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <SarwaProvider client={sarwa}>
        <AdminProvider client={client}>{children}</AdminProvider>
      </SarwaProvider>
    </QueryClientProvider>
  );
  return { Wrapper, queryClient, client, socket };
}
