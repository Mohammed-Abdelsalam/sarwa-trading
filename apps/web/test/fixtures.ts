import {
  type AuthSessionResponse,
  type CustomerUser,
  type Order,
  type PortfolioResponse,
  type Quote,
  type StockWithQuote,
  type TradingStatus,
} from '@sarwa/contracts';
import {
  ApiError,
  type ApiClient,
  type ClientAuth,
  createGateStore,
  createIntentStorage,
  createLiveStore,
  createRemovalQueue,
  createSessionStore,
  type KeyValueStorage,
  type SarwaClient,
  type SessionStatus,
  webCookieAuth,
} from '@sarwa/core';

export function memoryStorage(): KeyValueStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => Promise.resolve(values.get(key) ?? null),
    setItem: (key, value) => {
      values.set(key, value);
      return Promise.resolve();
    },
  };
}

export function makeUser(overrides: Partial<CustomerUser> = {}): CustomerUser {
  return {
    id: 'u1',
    email: 'sara.h@example.com',
    name: 'Sara Hassan',
    emailVerified: true,
    createdAt: Date.UTC(2026, 9, 2, 12),
    passwordChangedAt: null,
    account: { id: 'a1', handle: 'ACC-7F2E9A' },
    ...overrides,
  };
}

// Customer accounts wired as on the web: a guest unless a user is given.
export function testAuth({
  status,
  user = null,
}: { status?: SessionStatus; user?: CustomerUser | null } = {}): ClientAuth {
  return {
    transport: webCookieAuth({ readCookie: () => null }),
    session: createSessionStore({
      status: status ?? (user ? 'authenticated' : 'guest'),
      user,
      suspension: null,
      revokedReason: null,
    }),
    gate: createGateStore(),
    intents: createIntentStorage(memoryStorage()),
  };
}

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

export function createTestClient(api: Partial<ApiClient>, auth?: ClientAuth): SarwaClient {
  return {
    auth,
    api: api as ApiClient,
    store: createLiveStore(),
    market: {
      connect: jest.fn(),
      disconnect: jest.fn(),
      acquire: jest.fn(() => jest.fn()),
      subscribedSymbols: () => [],
      onTradingEvent: () => () => undefined,
    },
    storage: memoryStorage(),
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

// A problem+json error as the API client raises it; extra fields ride in the body.
export function apiProblem(status: number, code: string, extra: object = {}): ApiError {
  const problem = { type: 'about:blank', title: code, status, code, ...extra };
  return new ApiError(problem as ConstructorParameters<typeof ApiError>[0], problem);
}

export function sessionResponse(overrides: Partial<AuthSessionResponse> = {}): AuthSessionResponse {
  return { user: makeUser(), accessExpiresAt: 1, ...overrides };
}
