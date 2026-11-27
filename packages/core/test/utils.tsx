import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';

import { type Quote, type StockWithQuote } from '@sarwa/contracts';

import { ApiError, type ApiClient } from '../src/api';
import { type KeyValueStorage } from '../src/device';
import { type MarketSocket } from '../src/market-socket';
import { type SarwaClient, SarwaProvider } from '../src/provider';
import { createLiveStore } from '../src/store';
import { createRemovalQueue } from '../src/undo';

export function makeQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    symbol: 'AAPL',
    price: 231.48,
    prevClose: 228.64,
    open: 229.1,
    dayHigh: 232.1,
    dayLow: 228.4,
    volume: 1_000,
    ts: 1_000,
    seq: 1,
    ...overrides,
  };
}

export function makeStock(
  symbol: string,
  overrides: Partial<StockWithQuote> = {},
  quote: Partial<Quote> = {},
): StockWithQuote {
  return {
    symbol,
    name: `${symbol} Inc.`,
    sector: 'tech',
    exchange: 'NASDAQ',
    currency: 'USD',
    sparkline: [1, 2],
    marketCap: 1_000_000_000,
    quote: makeQuote({ symbol, ...quote }),
    ...overrides,
  };
}

export function makeProblem(status: number): ApiError {
  return new ApiError({ type: 'about:blank', title: 'Error', status, code: 'X' });
}

export function createTestClient(api: Partial<ApiClient> = {}): SarwaClient {
  const market: MarketSocket = {
    connect: jest.fn(),
    disconnect: jest.fn(),
    acquire: jest.fn(() => jest.fn()),
    subscribedSymbols: () => [],
  };
  return {
    api: api as ApiClient,
    market,
    store: createLiveStore(),
    storage: createMemoryStorage(),
    removals: createRemovalQueue(),
    analytics: { track: jest.fn() },
  };
}

export function createMemoryStorage(initial: Record<string, string> = {}): KeyValueStorage {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => Promise.resolve(values.get(key) ?? null),
    setItem: (key, value) => {
      values.set(key, value);
      return Promise.resolve();
    },
  };
}

export function createWrapper(client: SarwaClient) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <SarwaProvider client={client}>{children}</SarwaProvider>
    </QueryClientProvider>
  );
  return { Wrapper, queryClient };
}
