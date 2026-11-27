import { z } from 'zod';

import {
  ALERT_CONDITIONS,
  ALERT_REPEATS,
  CANCEL_REASONS,
  ORDER_STATUSES,
  ORDER_TYPES,
  REJECTION_CODES,
  SESSION_MODES,
  SESSION_PHASES,
  SIDES,
  TIME_IN_FORCE,
} from '@sarwa/domain';

import { SectorSchema, SymbolSchema } from './market';

// Money, quantities and prices travel as integers in their smallest unit, named by suffix:
// …Cents (US cents), …Micros (millionths of a share), …Ticks (1/10,000 $), …Bps (basis points).
const Cents = z.number().int();
const PositiveCents = Cents.positive();
const Micros = z.number().int().nonnegative();
const Ticks = z.number().int().positive();
const Bps = z.number().int();
const Timestamp = z.number().int().nonnegative();
const Id = z.string().min(1).max(64);

export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';
export const IdempotencyKeySchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{8,64}$/, 'Idempotency-Key must be 8–64 URL-safe characters');

export const SideSchema = z.enum(SIDES);
export const OrderTypeSchema = z.enum(ORDER_TYPES);
export const TimeInForceSchema = z.enum(TIME_IN_FORCE);
export const OrderStatusSchema = z.enum(ORDER_STATUSES);
export const RejectionCodeSchema = z.enum(REJECTION_CODES);
export const SessionModeSchema = z.enum(SESSION_MODES);
export const SessionPhaseSchema = z.enum(SESSION_PHASES);

export const RejectionSchema = z.discriminatedUnion('code', [
  z.object({
    code: z.enum(['TRADING_DISABLED', 'MARKET_PAUSED', 'SYMBOL_HALTED', 'MARKET_CLOSED']),
  }),
  z.object({ code: z.literal('STALE_QUOTE'), ageMs: Timestamp, maxAgeMs: Timestamp }),
  z.object({
    code: z.literal('INVALID_PRICE'),
    field: z.enum(['limit', 'stop']),
    lastTicks: Ticks,
  }),
  z.object({
    code: z.literal('PRICE_COLLAR'),
    field: z.enum(['limit', 'stop']),
    minTicks: Ticks,
    maxTicks: Ticks,
  }),
  z.object({ code: z.literal('MIN_NOTIONAL'), field: z.literal('size'), minCents: Cents }),
  z.object({ code: z.literal('MAX_NOTIONAL'), field: z.literal('size'), maxCents: Cents }),
  z.object({
    code: z.literal('INSUFFICIENT_FUNDS'),
    field: z.literal('size'),
    requiredCents: Cents,
    availableCents: Cents,
  }),
  z.object({
    code: z.literal('INSUFFICIENT_SHARES'),
    field: z.literal('size'),
    sellableMicros: Micros,
  }),
]);

export const OrderSizeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('amount'), cents: PositiveCents }),
  z.object({ kind: z.literal('shares'), micros: Micros.positive() }),
  z.object({ kind: z.literal('all') }),
]);

export const PlaceOrderRequestSchema = z
  .object({
    symbol: SymbolSchema,
    side: SideSchema,
    type: OrderTypeSchema,
    tif: TimeInForceSchema,
    size: OrderSizeSchema,
    limitTicks: Ticks.optional(),
    stopTicks: Ticks.optional(),
    // The price shown when the order was reviewed, so the result can report slippage against it.
    quotedTicks: Ticks,
  })
  .superRefine((order, ctx) => {
    const issue = (path: string, message: string) => {
      ctx.addIssue({ code: 'custom', path: [path], message });
    };
    if (order.type === 'limit' && order.limitTicks === undefined)
      issue('limitTicks', 'A limit order needs a limit price');
    if (order.type === 'stop' && order.stopTicks === undefined)
      issue('stopTicks', 'A stop order needs a stop price');
    if (order.type !== 'limit' && order.limitTicks !== undefined)
      issue('limitTicks', 'Only limit orders take a limit price');
    if (order.type !== 'stop' && order.stopTicks !== undefined)
      issue('stopTicks', 'Only stop orders take a stop price');
    if (order.type === 'market' && order.tif !== 'day')
      issue('tif', 'Market orders are day orders');
    if (order.size.kind === 'all' && order.side !== 'sell')
      issue('size', 'Only a sell can close the whole position');
  });

export const ModifyOrderRequestSchema = z
  .object({
    qtyMicros: Micros.positive().optional(),
    limitTicks: Ticks.optional(),
    stopTicks: Ticks.optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, 'Change at least one field');

export const FillSchema = z.object({
  id: Id,
  qtyMicros: Micros.positive(),
  priceTicks: Ticks,
  notionalCents: Cents,
  realizedCents: Cents,
  at: Timestamp,
});

export const CancelReasonSchema = z.enum(CANCEL_REASONS);

export const OrderSchema = z.object({
  id: Id,
  symbol: SymbolSchema,
  side: SideSchema,
  type: OrderTypeSchema,
  tif: TimeInForceSchema,
  status: OrderStatusSchema,
  qtyMicros: Micros.nullable(),
  amountCents: PositiveCents.nullable(),
  sellAll: z.boolean(),
  limitTicks: Ticks.nullable(),
  stopTicks: Ticks.nullable(),
  quotedTicks: Ticks,
  filledMicros: Micros,
  filledNotionalCents: Cents,
  avgFillTicks: Ticks.nullable(),
  heldCents: Cents,
  heldMicros: Micros,
  rejection: RejectionSchema.nullable(),
  cancelReason: CancelReasonSchema.nullable(),
  fills: z.array(FillSchema),
  createdAt: Timestamp,
  updatedAt: Timestamp,
  triggeredAt: Timestamp.nullable(),
  expiresAt: Timestamp.nullable(),
  closedAt: Timestamp.nullable(),
});

export const PlaceOrderResponseSchema = z.object({ order: OrderSchema });

export const CancelOutcomeSchema = z.enum(['canceled', 'already_filled', 'already_closed']);
export const CancelOrderResponseSchema = z.object({
  outcome: CancelOutcomeSchema,
  order: OrderSchema,
});

export const OrderFilterSchema = z.enum(['open', 'filled', 'all']);
export const OrdersQuerySchema = z.object({
  filter: OrderFilterSchema.default('all'),
  symbol: SymbolSchema.optional(),
  cursor: Id.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export const OrdersResponseSchema = z.object({
  items: z.array(OrderSchema),
  nextCursor: Id.nullable(),
});

export const AccountSchema = z.object({
  id: Id,
  // A public handle: the device id is a secret, so support and admins refer to this instead.
  handle: z.string().regex(/^ACC-[0-9A-F]{6}$/),
  cashCents: Cents,
  startingCashCents: PositiveCents,
  createdAt: Timestamp,
  resetAt: Timestamp.nullable(),
});

export const HoldSchema = z.object({
  orderId: Id,
  side: SideSchema,
  symbol: SymbolSchema,
  heldCents: Cents,
  heldMicros: Micros,
});

export const PortfolioPositionSchema = z.object({
  symbol: SymbolSchema,
  sector: SectorSchema,
  qtyMicros: Micros.positive(),
  costBasisCents: Cents,
  today: z.object({ qtyAtOpenMicros: Micros, boughtCents: Cents, soldCents: Cents }).nullable(),
});

// Raw books, not a computed summary: clients summarize with live prices via @sarwa/domain, so the
// P&L moves with every tick without polling.
export const PortfolioResponseSchema = z.object({
  account: AccountSchema,
  positions: z.array(PortfolioPositionSchema),
  holds: z.array(HoldSchema),
  realizedYtdCents: Cents,
  equityAtLastCloseCents: Cents.nullable(),
  asOf: Timestamp,
});

export const EquityPeriodSchema = z.enum(['1D', '1W', '1M', '1Y', 'ALL']);
export const EquityQuerySchema = z.object({ period: EquityPeriodSchema });
export const EquityResponseSchema = z.object({
  period: EquityPeriodSchema,
  points: z.array(z.object({ t: Timestamp, equityCents: Cents })),
});

export const AlertConditionSchema = z.enum(ALERT_CONDITIONS);
export const AlertRepeatSchema = z.enum(ALERT_REPEATS);

const alertThreshold = (
  alert: { condition: string; thresholdTicks?: number; thresholdBps?: number },
  ctx: z.RefinementCtx,
) => {
  const isMove = alert.condition === 'move_today';
  if (isMove && (alert.thresholdBps === undefined || alert.thresholdBps === 0)) {
    ctx.addIssue({ code: 'custom', path: ['thresholdBps'], message: 'Enter a % move' });
  }
  if (!isMove && alert.thresholdTicks === undefined) {
    ctx.addIssue({ code: 'custom', path: ['thresholdTicks'], message: 'Enter a target price' });
  }
};

export const CreateAlertRequestSchema = z
  .object({
    symbol: SymbolSchema,
    condition: AlertConditionSchema,
    thresholdTicks: Ticks.optional(),
    thresholdBps: Bps.min(-10_000).max(10_000).optional(),
    repeat: AlertRepeatSchema,
  })
  .superRefine(alertThreshold);

export const UpdateAlertRequestSchema = z
  .object({ enabled: z.boolean().optional(), repeat: AlertRepeatSchema.optional() })
  .refine(
    (patch) => patch.enabled !== undefined || patch.repeat !== undefined,
    'Change at least one field',
  );

export const AlertSchema = z.object({
  id: Id,
  symbol: SymbolSchema,
  condition: AlertConditionSchema,
  thresholdTicks: Ticks.nullable(),
  thresholdBps: Bps.nullable(),
  repeat: AlertRepeatSchema,
  enabled: z.boolean(),
  armed: z.boolean(),
  lastFiredAt: Timestamp.nullable(),
  createdAt: Timestamp,
});

export const AlertResponseSchema = z.object({ alert: AlertSchema });

export const AlertsResponseSchema = z.object({
  items: z.array(AlertSchema),
  activeCount: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
});

// Notifications carry data, not sentences: each client renders them in its own language.
export const NotificationPayloadSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.enum(['order_filled', 'order_partially_filled', 'order_expired', 'order_canceled']),
    orderId: Id,
    symbol: SymbolSchema,
    side: SideSchema,
    qtyMicros: Micros,
    priceTicks: Ticks.nullable(),
    // Value of this fill (partially filled) or of everything filled so far (the other kinds).
    notionalCents: Cents,
  }),
  z.object({
    kind: z.literal('order_rejected'),
    orderId: Id,
    symbol: SymbolSchema,
    side: SideSchema,
    rejection: RejectionSchema,
  }),
  z.object({
    kind: z.literal('alert_triggered'),
    alertId: Id,
    symbol: SymbolSchema,
    condition: AlertConditionSchema,
    thresholdTicks: Ticks.nullable(),
    thresholdBps: Bps.nullable(),
    lastTicks: Ticks,
  }),
  z.object({
    kind: z.literal('symbol_halted'),
    symbol: SymbolSchema,
    message: z.string(),
    resumesAt: Timestamp.nullable(),
  }),
  z.object({ kind: z.literal('market_notice'), message: z.string() }),
]);

export const NotificationSchema = z.object({
  id: Id,
  payload: NotificationPayloadSchema,
  readAt: Timestamp.nullable(),
  createdAt: Timestamp,
});

export const NotificationsQuerySchema = z.object({
  cursor: Id.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
export const NotificationsResponseSchema = z.object({
  items: z.array(NotificationSchema),
  nextCursor: Id.nullable(),
  unreadCount: z.number().int().nonnegative(),
});

export const PushTokenRequestSchema = z.object({
  token: z.string().min(1).max(512),
  platform: z.enum(['ios', 'android', 'web']),
});

export const ExecutionRulesSchema = z.object({
  spreadBps: Bps.min(0).max(500),
  maxSlippageBps: Bps.min(0).max(500),
  collarBps: Bps.min(100).max(5_000),
  staleQuoteMs: z.number().int().min(1_000).max(60_000),
  minNotionalCents: PositiveCents,
  maxNotionalCents: PositiveCents,
  closedMarketBufferBps: Bps.min(0).max(2_000),
  queueWhenClosed: z.boolean(),
});

export const CircuitBreakerSchema = z.object({
  enabled: z.boolean(),
  moveBps: Bps.min(100).max(5_000),
  windowMs: z.number().int().min(60_000).max(3_600_000),
  haltMs: z.number().int().min(60_000).max(3_600_000),
});

export const HaltSchema = z.object({
  symbol: SymbolSchema,
  source: z.enum(['circuit_breaker', 'admin']),
  // Shown to users, e.g. "News pending — volatility pause".
  message: z.string().trim().min(1).max(80),
  since: Timestamp,
  resumesAt: Timestamp.nullable(),
});

export const MarketSessionSchema = z.object({
  phase: SessionPhaseSchema,
  isOpen: z.boolean(),
  opensAt: Timestamp,
  closesAt: Timestamp,
  earlyClose: z.boolean(),
});

export const CalendarDaySchema = z.object({
  date: z.iso.date(),
  kind: z.enum(['holiday', 'early_close']),
  label: z.string(),
  closesAt: Timestamp.nullable(),
});

// Everything a client needs to gate the Buy/Sell buttons the same way the server will.
export const TradingStatusSchema = z.object({
  tradingEnabled: z.boolean(),
  sessionMode: SessionModeSchema,
  session: MarketSessionSchema,
  rules: ExecutionRulesSchema,
  halts: z.array(HaltSchema),
  upcoming: z.array(CalendarDaySchema),
  updatedAt: Timestamp,
});

export type IdempotencyKey = z.infer<typeof IdempotencyKeySchema>;
export type RejectionWire = z.infer<typeof RejectionSchema>;
export type OrderSizeWire = z.infer<typeof OrderSizeSchema>;
export type PlaceOrderRequest = z.infer<typeof PlaceOrderRequestSchema>;
export type ModifyOrderRequest = z.infer<typeof ModifyOrderRequestSchema>;
export type Fill = z.infer<typeof FillSchema>;
export type CancelReason = z.infer<typeof CancelReasonSchema>;
export type Order = z.infer<typeof OrderSchema>;
export type PlaceOrderResponse = z.infer<typeof PlaceOrderResponseSchema>;
export type CancelOrderResponse = z.infer<typeof CancelOrderResponseSchema>;
export type OrderFilter = z.infer<typeof OrderFilterSchema>;
export type OrdersQuery = z.infer<typeof OrdersQuerySchema>;
export type OrdersResponse = z.infer<typeof OrdersResponseSchema>;
export type Account = z.infer<typeof AccountSchema>;
export type HoldWire = z.infer<typeof HoldSchema>;
export type PortfolioPosition = z.infer<typeof PortfolioPositionSchema>;
export type PortfolioResponse = z.infer<typeof PortfolioResponseSchema>;
export type EquityPeriod = z.infer<typeof EquityPeriodSchema>;
export type EquityResponse = z.infer<typeof EquityResponseSchema>;
export type CreateAlertRequest = z.infer<typeof CreateAlertRequestSchema>;
export type UpdateAlertRequest = z.infer<typeof UpdateAlertRequestSchema>;
export type Alert = z.infer<typeof AlertSchema>;
export type AlertResponse = z.infer<typeof AlertResponseSchema>;
export type AlertsResponse = z.infer<typeof AlertsResponseSchema>;
export type NotificationPayload = z.infer<typeof NotificationPayloadSchema>;
export type Notification = z.infer<typeof NotificationSchema>;
export type NotificationsQuery = z.infer<typeof NotificationsQuerySchema>;
export type NotificationsResponse = z.infer<typeof NotificationsResponseSchema>;
export type PushTokenRequest = z.infer<typeof PushTokenRequestSchema>;
export type ExecutionRulesWire = z.infer<typeof ExecutionRulesSchema>;
export type CircuitBreaker = z.infer<typeof CircuitBreakerSchema>;
export type Halt = z.infer<typeof HaltSchema>;
export type MarketSessionWire = z.infer<typeof MarketSessionSchema>;
export type CalendarDay = z.infer<typeof CalendarDaySchema>;
export type TradingStatus = z.infer<typeof TradingStatusSchema>;
