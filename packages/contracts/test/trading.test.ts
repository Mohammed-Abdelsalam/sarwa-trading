import { REJECTION_CODES, type Rejection } from '@sarwa/domain';

import {
  CreateAlertRequestSchema,
  CreateHaltSchema,
  IdempotencyKeySchema,
  ModifyOrderRequestSchema,
  NotificationPayloadSchema,
  OrderUpdatedEventSchema,
  PlaceOrderRequestSchema,
  RejectionCodeSchema,
  type RejectionWire,
  resetConfirmation,
  UpdateTradingSchema,
} from '../src';

// The wire rejection and the domain rejection must stay the same shape in both directions.
const toDomain = (rejection: RejectionWire): Rejection => rejection;
const toWire = (rejection: Rejection): RejectionWire => rejection;

const marketBuy = {
  symbol: 'AAPL',
  side: 'buy',
  type: 'market',
  tif: 'day',
  size: { kind: 'amount', cents: 50_000 },
  quotedTicks: 2_315_000,
} as const;

const issuesOf = (result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  result.error?.issues.map((issue) => issue.path.join('.')) ?? [];

describe('PlaceOrderRequestSchema', () => {
  it('accepts a market buy for a dollar amount', () => {
    expect(PlaceOrderRequestSchema.safeParse(marketBuy).success).toBe(true);
  });

  it('requires the price that matches the order type', () => {
    const limit = PlaceOrderRequestSchema.safeParse({ ...marketBuy, type: 'limit', tif: 'gtc' });
    const stop = PlaceOrderRequestSchema.safeParse({ ...marketBuy, type: 'stop', limitTicks: 1 });

    expect(issuesOf(limit)).toEqual(['limitTicks']);
    expect(issuesOf(stop)).toEqual(['stopTicks', 'limitTicks']);
  });

  it('keeps market orders to the day and closing the whole position to sells', () => {
    const result = PlaceOrderRequestSchema.safeParse({
      ...marketBuy,
      tif: 'gtc',
      size: { kind: 'all' },
    });

    expect(issuesOf(result)).toEqual(['tif', 'size']);
  });

  it('rejects a non-integer amount, since money travels in cents', () => {
    const result = PlaceOrderRequestSchema.safeParse({
      ...marketBuy,
      size: { kind: 'amount', cents: 10.5 },
    });

    expect(result.success).toBe(false);
  });
});

describe('ModifyOrderRequestSchema', () => {
  it('needs at least one change', () => {
    expect(ModifyOrderRequestSchema.safeParse({}).success).toBe(false);
    expect(ModifyOrderRequestSchema.safeParse({ limitTicks: 2_290_000 }).success).toBe(true);
  });
});

describe('IdempotencyKeySchema', () => {
  it('accepts URL-safe keys of 8 to 64 characters only', () => {
    expect(IdempotencyKeySchema.safeParse('7c1e9a2f-key').success).toBe(true);
    expect(IdempotencyKeySchema.safeParse('short').success).toBe(false);
    expect(IdempotencyKeySchema.safeParse('has spaces in it').success).toBe(false);
  });
});

describe('rejections', () => {
  it('lists every domain rejection code on the wire', () => {
    expect(RejectionCodeSchema.options).toEqual([...REJECTION_CODES]);
  });

  it('round-trips a rejection between the domain and the wire', () => {
    const collar: Rejection = { code: 'PRICE_COLLAR', field: 'limit', minTicks: 1, maxTicks: 2 };

    expect(toDomain(toWire(collar))).toEqual(collar);
  });
});

describe('CreateAlertRequestSchema', () => {
  const alert = { symbol: 'AAPL', repeat: 'once' } as const;

  it('needs a price for price alerts and a non-zero move for move alerts', () => {
    expect(CreateAlertRequestSchema.safeParse({ ...alert, condition: 'price_above' }).success).toBe(
      false,
    );
    expect(
      CreateAlertRequestSchema.safeParse({ ...alert, condition: 'move_today', thresholdBps: 0 })
        .success,
    ).toBe(false);
    expect(
      CreateAlertRequestSchema.safeParse({ ...alert, condition: 'move_today', thresholdBps: -500 })
        .success,
    ).toBe(true);
  });
});

describe('NotificationPayloadSchema', () => {
  it('carries data for the client to word, not a sentence', () => {
    const payload = {
      kind: 'order_rejected',
      orderId: 'o_1',
      symbol: 'META',
      side: 'buy',
      rejection: { code: 'INSUFFICIENT_FUNDS', field: 'size', requiredCents: 1, availableCents: 0 },
    };

    expect(NotificationPayloadSchema.parse(payload)).toEqual(payload);
  });
});

describe('versioned socket events', () => {
  it('drops an event version the client does not know', () => {
    expect(OrderUpdatedEventSchema.safeParse({ v: 2, order: {} }).success).toBe(false);
  });
});

describe('admin trading', () => {
  it('rejects an empty update and a min notional above the max', () => {
    expect(UpdateTradingSchema.safeParse({}).success).toBe(false);
    expect(
      UpdateTradingSchema.safeParse({ rules: { minNotionalCents: 500, maxNotionalCents: 100 } })
        .success,
    ).toBe(false);
    expect(UpdateTradingSchema.safeParse({ tradingEnabled: false }).success).toBe(true);
  });

  it('asks the admin to say why a symbol is halted', () => {
    const halt = { symbol: 'TSLA', message: ' ', duration: '15m', notify: true };

    expect(CreateHaltSchema.safeParse(halt).success).toBe(false);
  });

  it('confirms a reset by typing the account handle', () => {
    expect(resetConfirmation('ACC-7F3A9C')).toBe('RESET ACC-7F3A9C');
  });
});
