import {
  type Alert,
  type Notification,
  type Order,
  type PortfolioResponse,
  type TradingStatus,
} from '@sarwa/contracts';
import { DEFAULT_EXECUTION_RULES } from '@sarwa/domain';

export function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'ord-1',
    symbol: 'AAPL',
    side: 'buy',
    type: 'market',
    tif: 'day',
    status: 'open',
    qtyMicros: null,
    amountCents: 10_000,
    sellAll: false,
    limitTicks: null,
    stopTicks: null,
    quotedTicks: 2_315_000,
    filledMicros: 0,
    filledNotionalCents: 0,
    avgFillTicks: null,
    heldCents: 10_000,
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

export function makeFilledOrder(overrides: Partial<Order> = {}): Order {
  return makeOrder({
    status: 'filled',
    filledMicros: 431_965,
    filledNotionalCents: 10_000,
    avgFillTicks: 2_315_100,
    heldCents: 0,
    updatedAt: 2_000,
    closedAt: 2_000,
    ...overrides,
  });
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
    rules: DEFAULT_EXECUTION_RULES,
    halts: [],
    upcoming: [],
    updatedAt: 1,
    ...overrides,
  };
}

// $10,000 cash and 10 AAPL shares bought for $2,000.
export function makePortfolio(overrides: Partial<PortfolioResponse> = {}): PortfolioResponse {
  return {
    account: {
      id: 'acc-1',
      handle: 'ACC-ABC123',
      cashCents: 1_000_000,
      startingCashCents: 1_200_000,
      createdAt: 1,
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
    asOf: 1,
    ...overrides,
  };
}

export function makeAlert(overrides: Partial<Alert> = {}): Alert {
  return {
    id: 'al-1',
    symbol: 'AAPL',
    condition: 'price_above',
    thresholdTicks: 2_500_000,
    thresholdBps: null,
    repeat: 'once',
    enabled: true,
    armed: true,
    lastFiredAt: null,
    createdAt: 1,
    ...overrides,
  };
}

export function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'n-1',
    payload: { kind: 'market_notice', message: 'Hello' },
    readAt: null,
    createdAt: 1,
    ...overrides,
  };
}
