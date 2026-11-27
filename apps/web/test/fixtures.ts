import {
  type Order,
  type PortfolioResponse,
  type Quote,
  type StockWithQuote,
  type TradingStatus,
} from '@sarwa/contracts';
import { type ApiClient, createLiveStore, createRemovalQueue, type SarwaClient } from '@sarwa/core';

export function makeQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    symbol: 'AAPL',
    price: 231.48,
    prevClose: 228.64,
    bid: 231.46,
    ask: 231.5,
    bidSize: 300,
    askSize: 200,
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
      onTradingEvent: () => () => undefined,
    },
    storage: {
      getItem: (key) => Promise.resolve(values.get(key) ?? null),
      setItem: (key, value) => {
        values.set(key, value);
        return Promise.resolve();
      },
    },
    removals: createRemovalQueue(),
    analytics: { track: jest.fn() },
    newId: () => 'test-idempotency-key',
  };
}

export function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'ord-1',
    symbol: 'AAPL',
    side: 'buy',
    type: 'market',
    tif: 'day',
    status: 'open',
    qtyMicros: null,
    amountCents: 50_000,
    sellAll: false,
    limitTicks: null,
    stopTicks: null,
    quotedTicks: 2_315_000,
    filledMicros: 0,
    filledNotionalCents: 0,
    avgFillTicks: null,
    heldCents: 50_000,
    heldMicros: 0,
    rejection: null,
    cancelReason: null,
    fills: [],
    createdAt: 1_000,
    updatedAt: 1_000,
    triggeredAt: null,
    expiresAt: null,
    closedAt: null,
    ...overrides,
  };
}

export function makeTradingStatus(overrides: Partial<TradingStatus> = {}): TradingStatus {
  return {
    tradingEnabled: true,
    sessionMode: 'always-open',
    session: {
      phase: 'regular',
      isOpen: true,
      opensAt: 0,
      closesAt: 9_000_000_000_000,
      earlyClose: false,
    },
    rules: {
      spreadBps: 2,
      maxSlippageBps: 5,
      collarBps: 1_000,
      staleQuoteMs: 5_000,
      minNotionalCents: 100,
      maxNotionalCents: 25_000_000,
      closedMarketBufferBps: 500,
      queueWhenClosed: true,
    },
    halts: [],
    upcoming: [],
    updatedAt: 1,
    ...overrides,
  };
}

// $10,000 cash and 10 AAPL bought for $2,000.
export function makePortfolio(overrides: Partial<PortfolioResponse> = {}): PortfolioResponse {
  return {
    account: {
      id: 'acc-1',
      handle: 'ACC-ABC123',
      cashCents: 1_000_000,
      startingCashCents: 1_200_000,
      createdAt: 0,
      resetAt: null,
    },
    positions: [
      {
        symbol: 'AAPL',
        sector: 'tech',
        qtyMicros: 10_000_000,
        costBasisCents: 200_000,
        today: null,
      },
    ],
    holds: [],
    realizedYtdCents: 0,
    equityAtLastCloseCents: null,
    asOf: 0,
    ...overrides,
  };
}
