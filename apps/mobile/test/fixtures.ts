import { type Notification, type Order } from '@sarwa/contracts';

// 1 share = 1,000,000 micros, $1 = 10,000 ticks = 100 cents.
export function order(overrides: Partial<Order> = {}): Order {
  return {
    id: 'o_1',
    symbol: 'AAPL',
    side: 'buy',
    type: 'market',
    tif: 'day',
    status: 'filled',
    qtyMicros: null,
    amountCents: 50_000,
    sellAll: false,
    limitTicks: null,
    stopTicks: null,
    quotedTicks: 2_315_000,
    filledMicros: 2_159_827,
    filledNotionalCents: 50_000,
    avgFillTicks: 2_315_200,
    heldCents: 0,
    heldMicros: 0,
    rejection: null,
    cancelReason: null,
    fills: [],
    createdAt: Date.UTC(2026, 10, 27, 19, 41),
    updatedAt: Date.UTC(2026, 10, 27, 19, 41),
    triggeredAt: null,
    expiresAt: null,
    closedAt: null,
    ...overrides,
  };
}

export function notification(
  payload: Notification['payload'],
  createdAt: number,
  read = false,
): Notification {
  return { id: `n_${String(createdAt)}`, payload, createdAt, readAt: read ? createdAt : null };
}
