import { type Quote, type StockWithQuote } from '@sarwa/contracts';
import { type ApiClient, createLiveStore, createRemovalQueue, type SarwaClient } from '@sarwa/core';

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

export function makeStock(symbol: string, overrides: Partial<StockWithQuote> = {}): StockWithQuote {
  return {
    symbol,
    name: `${symbol} Inc.`,
    sector: 'tech',
    exchange: 'NASDAQ',
    currency: 'USD',
    sparkline: [1, 2],
    marketCap: 1_000_000_000,
    quote: makeQuote({ symbol }),
    ...overrides,
  };
}

export function createTestClient(api: Partial<ApiClient>): SarwaClient {
  const values = new Map<string, string>();
  return {
    api: api as ApiClient,
    store: createLiveStore(),
    market: {
      connect: jest.fn(),
      disconnect: jest.fn(),
      acquire: jest.fn(() => jest.fn()),
      subscribedSymbols: () => [],
    },
    storage: {
      getItem: (key) => Promise.resolve(values.get(key) ?? null),
      setItem: (key, value) => {
        values.set(key, value);
        return Promise.resolve();
      },
    },
    removals: createRemovalQueue(),
  };
}
