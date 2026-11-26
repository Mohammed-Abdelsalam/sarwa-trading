import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode } from 'react';

import { type Quote } from '@sarwa/contracts';

import { type ApiClient } from './api';
import { type MarketSocket } from './market-socket';
import { type SarwaClient, SarwaProvider } from './provider';
import { createLiveStore } from './store';

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

export function createTestClient(api: Partial<ApiClient> = {}): SarwaClient {
  const market: MarketSocket = {
    connect: jest.fn(),
    disconnect: jest.fn(),
    acquire: jest.fn(() => jest.fn()),
    subscribedSymbols: () => [],
  };
  return { api: api as ApiClient, market, store: createLiveStore() };
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
