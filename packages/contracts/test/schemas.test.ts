import { type z } from 'zod';

import {
  ALERT_CONDITIONS,
  ALERT_REPEATS,
  DEFAULT_CIRCUIT_BREAKER,
  DEFAULT_EXECUTION_RULES,
  ORDER_STATUSES,
  SESSION_MODES,
  SESSION_PHASES,
  SIDES,
  TIME_IN_FORCE,
} from '@sarwa/domain';

import {
  AccountSchema,
  ADMIN_NAMESPACE,
  ADMIN_SESSION_COOKIE,
  AdminAccountSchema,
  AdminAccountsQuerySchema,
  AdminAccountsResponseSchema,
  AdminOrderEventSchema,
  AdminOrderSchema,
  AdminOrdersQuerySchema,
  AdminOrdersResponseSchema,
  AdminOrderStatsSchema,
  AdminSocketEvent,
  AdminStatsSchema,
  AdminStockSchema,
  AdminStocksResponseSchema,
  AdminTradingSchema,
  AdminUserSchema,
  AlertResponseSchema,
  AlertSchema,
  AlertsResponseSchema,
  AlertTriggeredEventSchema,
  API_PREFIX,
  AUDIT_ACTIONS,
  AuditLogSchema,
  AuditPageSchema,
  BannerSchema,
  CalendarDaySchema,
  CancelOrderResponseSchema,
  CancelReasonSchema,
  CandlesQuerySchema,
  CandlesResponseSchema,
  CircuitBreakerSchema,
  CreateHaltSchema,
  CreateUserSchema,
  DEVICE_ID_HEADER,
  EquityQuerySchema,
  EquityResponseSchema,
  ErrorCode,
  ExecutionRulesSchema,
  FillSchema,
  HALT_DURATIONS,
  HaltImpactSchema,
  HaltSchema,
  HealthResponseSchema,
  HoldSchema,
  IDEMPOTENCY_KEY_HEADER,
  MARKET_NAMESPACE,
  MarketCommandResponseSchema,
  MarketSessionSchema,
  MarketStateSchema,
  ModifyOrderRequestSchema,
  NotificationEventSchema,
  NotificationPayloadSchema,
  NotificationSchema,
  NotificationsQuerySchema,
  NotificationsResponseSchema,
  OrderFilterSchema,
  OrderSchema,
  OrderSizeSchema,
  OrdersQuerySchema,
  OrdersResponseSchema,
  OrderUpdatedEventSchema,
  PlaceOrderRequestSchema,
  PlaceOrderResponseSchema,
  PortfolioPositionSchema,
  PortfolioResponseSchema,
  ProblemSchema,
  PushTokenRequestSchema,
  QUOTE_BATCH_MS,
  QuotesEventSchema,
  ResetAccountSchema,
  SessionResponseSchema,
  SocketAuthSchema,
  SocketErrorSchema,
  SocketEvent,
  StockDetailResponseSchema,
  StocksResponseSchema,
  SymbolHaltedEventSchema,
  SymbolResumedEventSchema,
  TICK_MS,
  TradingSocketEvent,
  TradingStatusEventSchema,
  TradingStatusSchema,
  UpdateAlertRequestSchema,
  UsersResponseSchema,
  WatchlistResponseSchema,
  AlertConditionSchema,
  AlertRepeatSchema,
  AuditActionSchema,
  BannerToneSchema,
  CancelOutcomeSchema,
  EquityPeriodSchema,
  OrderStatusSchema,
  RoleSchema,
  SessionModeSchema,
  SessionPhaseSchema,
  SideSchema,
  TimeInForceSchema,
  UserStatusSchema,
} from '../src';

const order = {
  id: 'ord_1',
  symbol: 'AAPL',
  side: 'buy',
  type: 'limit',
  tif: 'gtc',
  status: 'partially_filled',
  qtyMicros: 1_000_000,
  amountCents: null,
  sellAll: false,
  limitTicks: 1_900_000,
  stopTicks: null,
  quotedTicks: 2_000_000,
  filledMicros: 500_000,
  filledNotionalCents: 95_000,
  avgFillTicks: 1_900_000,
  heldCents: 95_000,
  heldMicros: 0,
  rejection: null,
  cancelReason: null,
  fills: [
    {
      id: 'fill_1',
      qtyMicros: 500_000,
      priceTicks: 1_900_000,
      notionalCents: 95_000,
      realizedCents: 0,
      at: 5,
    },
  ],
  createdAt: 1,
  updatedAt: 5,
  triggeredAt: null,
  expiresAt: null,
  closedAt: null,
};
const account = {
  id: 'acc_1',
  handle: 'ACC-7F3A9C',
  cashCents: 9_905_000,
  startingCashCents: 10_000_000,
  createdAt: 1,
  resetAt: null,
};
const session = { phase: 'regular', isOpen: true, opensAt: 1, closesAt: 2, earlyClose: false };
const halt = { symbol: 'TSLA', source: 'admin', message: 'News pending', since: 1, resumesAt: 9 };
const holiday = { date: '2026-12-25', kind: 'holiday', label: 'Christmas', closesAt: null };
const status = {
  tradingEnabled: true,
  sessionMode: 'calendar',
  session,
  rules: DEFAULT_EXECUTION_RULES,
  halts: [halt],
  upcoming: [holiday],
  updatedAt: 1,
};
const alert = {
  id: 'al_1',
  symbol: 'AAPL',
  condition: 'price_above',
  thresholdTicks: 2_500_000,
  thresholdBps: null,
  repeat: 'once',
  enabled: true,
  armed: true,
  lastFiredAt: null,
  createdAt: 1,
};
const filledPayload = {
  kind: 'order_filled',
  orderId: 'ord_1',
  symbol: 'AAPL',
  side: 'buy',
  qtyMicros: 1,
  priceTicks: 1,
  notionalCents: 1,
};
const notification = { id: 'n_1', payload: filledPayload, readAt: null, createdAt: 1 };
const quote = {
  symbol: 'AAPL',
  price: 200,
  bid: 199.98,
  ask: 200.02,
  bidSize: 100,
  askSize: 200,
  prevClose: 198,
  open: 199,
  dayHigh: 201,
  dayLow: 197,
  volume: 1_000,
  ts: 1,
  seq: 1,
};
const stock = {
  symbol: 'AAPL',
  name: 'Apple',
  sector: 'tech',
  exchange: 'NASDAQ',
  currency: 'USD',
};
const adminUser = {
  id: 'u_1',
  email: 'maya@sarwa.dev',
  name: 'Maya',
  role: 'ADMIN',
  status: 'active',
  lastActiveAt: null,
  createdAt: '2026-11-01T10:00:00.000Z',
};
const auditLog = {
  id: 'log_1',
  actorEmail: 'maya@sarwa.dev',
  action: 'halt.create',
  entity: 'Halt · TSLA',
  payload: { symbol: 'TSLA' },
  ip: null,
  createdAt: '2026-11-01T10:00:00.000Z',
};
const adminOrder = { ...order, accountHandle: 'ACC-7F3A9C', latencyMs: 4 };
const adminAccount = {
  id: 'acc_1',
  handle: 'ACC-7F3A9C',
  createdAt: 1,
  equityCents: 10_000_000,
  cashCents: 9_000_000,
  todayCents: -500,
  allTimeCents: 0,
  allTimeBps: 0,
  positions: 1,
  openOrders: 0,
  lastTradeAt: null,
};

type Case = [name: string, schema: z.ZodType, valid: unknown, invalid: unknown[]];

const omit = (value: object, key: string) =>
  Object.fromEntries(Object.entries(value).filter(([k]) => k !== key));

const cases: Case[] = [
  // Trading: orders.
  ['OrderSize', OrderSizeSchema, { kind: 'shares', micros: 1 }, [{ kind: 'amount', cents: 0 }]],
  ['Fill', FillSchema, order.fills[0], [{ ...order.fills[0], qtyMicros: 0 }]],
  ['CancelReason', CancelReasonSchema, 'admin_reset', ['expired']],
  [
    'Order',
    OrderSchema,
    order,
    [{ ...order, status: 'working' }, { ...order, filledMicros: 0.5 }, omit(order, 'fills')],
  ],
  ['PlaceOrderResponse', PlaceOrderResponseSchema, { order }, [order]],
  [
    'CancelOrderResponse',
    CancelOrderResponseSchema,
    { outcome: 'already_filled', order },
    [{ outcome: 'failed', order }],
  ],
  ['OrderFilter', OrderFilterSchema, 'open', ['closed']],
  [
    'OrdersResponse',
    OrdersResponseSchema,
    { items: [order], nextCursor: 'ord_1' },
    [{ items: [order] }, { items: [order], nextCursor: '' }],
  ],
  // Trading: account and books.
  ['Account', AccountSchema, account, [{ ...account, handle: 'acc-1' }]],
  [
    'Hold',
    HoldSchema,
    { orderId: 'o', side: 'sell', symbol: 'AAPL', heldCents: 0, heldMicros: 1 },
    [{}],
  ],
  [
    'PortfolioPosition',
    PortfolioPositionSchema,
    {
      symbol: 'AAPL',
      sector: 'tech',
      qtyMicros: 1,
      costBasisCents: 1,
      today: { qtyAtOpenMicros: 0, boughtCents: 1, soldCents: 0 },
    },
    [{ symbol: 'AAPL', sector: 'tech', qtyMicros: 0, costBasisCents: 1, today: null }],
  ],
  [
    'PortfolioResponse',
    PortfolioResponseSchema,
    {
      account,
      positions: [],
      holds: [],
      realizedYtdCents: 0,
      equityAtLastCloseCents: null,
      asOf: 1,
    },
    [{ account, positions: [], holds: [], realizedYtdCents: 0, asOf: 1 }],
  ],
  ['EquityQuery', EquityQuerySchema, { period: 'ALL' }, [{ period: '5Y' }]],
  [
    'EquityResponse',
    EquityResponseSchema,
    { period: '1D', points: [{ t: 1, equityCents: 5 }] },
    [{ period: '1D', points: [{ t: -1, equityCents: 5 }] }],
  ],
  // Trading: alerts and notifications.
  ['Alert', AlertSchema, alert, [{ ...alert, condition: 'crosses' }]],
  ['AlertResponse', AlertResponseSchema, { alert }, [alert]],
  [
    'AlertsResponse',
    AlertsResponseSchema,
    { items: [alert], activeCount: 1, limit: 50 },
    [{ items: [alert], activeCount: -1, limit: 50 }],
  ],
  ['UpdateAlertRequest', UpdateAlertRequestSchema, { repeat: 'every' }, [{}]],
  [
    'NotificationPayload',
    NotificationPayloadSchema,
    {
      kind: 'alert_triggered',
      alertId: 'al_1',
      symbol: 'AAPL',
      condition: 'move_today',
      thresholdTicks: null,
      thresholdBps: -500,
      lastTicks: 1,
    },
    [{ kind: 'order_shipped' }, { ...filledPayload, priceTicks: 0 }],
  ],
  ['Notification', NotificationSchema, notification, [{ ...notification, readAt: 'never' }]],
  [
    'NotificationsQuery',
    NotificationsQuerySchema,
    { cursor: 'n_1', limit: '10' },
    [{ limit: '0' }, { limit: '101' }, { cursor: '' }],
  ],
  [
    'NotificationsResponse',
    NotificationsResponseSchema,
    { items: [notification], nextCursor: null, unreadCount: 1 },
    [{ items: [notification], unreadCount: 1 }],
  ],
  [
    'PushTokenRequest',
    PushTokenRequestSchema,
    { token: 'tok', platform: 'android' },
    [
      { token: '', platform: 'ios' },
      { token: 'tok', platform: 'windows' },
    ],
  ],
  // Trading: rules, sessions and status.
  [
    'ExecutionRules',
    ExecutionRulesSchema,
    DEFAULT_EXECUTION_RULES,
    [
      { ...DEFAULT_EXECUTION_RULES, spreadBps: -1 },
      { ...DEFAULT_EXECUTION_RULES, collarBps: 50 },
    ],
  ],
  [
    'CircuitBreaker',
    CircuitBreakerSchema,
    DEFAULT_CIRCUIT_BREAKER,
    [{ ...DEFAULT_CIRCUIT_BREAKER, windowMs: 1_000 }],
  ],
  [
    'Halt',
    HaltSchema,
    halt,
    [
      { ...halt, source: 'exchange' },
      { ...halt, message: '' },
    ],
  ],
  ['MarketSession', MarketSessionSchema, session, [{ ...session, phase: 'lunch' }]],
  ['CalendarDay', CalendarDaySchema, holiday, [{ ...holiday, date: '25/12/2026' }]],
  ['TradingStatus', TradingStatusSchema, status, [{ ...status, sessionMode: 'never' }]],
  // Admin trading.
  [
    'AdminTrading',
    AdminTradingSchema,
    {
      ...status,
      circuitBreaker: DEFAULT_CIRCUIT_BREAKER,
      tripsToday: [{ symbol: 'TSLA', at: 1 }],
      changedBy: 'maya@sarwa.dev',
      changedAt: 1,
    },
    [status],
  ],
  [
    'CreateHalt',
    CreateHaltSchema,
    { symbol: 'TSLA', message: 'News pending', duration: HALT_DURATIONS[0], notify: false },
    [{ symbol: 'TSLA', message: 'News', duration: '1h', notify: false }],
  ],
  [
    'HaltImpact',
    HaltImpactSchema,
    { symbol: 'TSLA', openOrders: 2, holdersAndWatchers: 3 },
    [{ symbol: 'TSLA', openOrders: -1, holdersAndWatchers: 3 }],
  ],
  ['AdminOrder', AdminOrderSchema, adminOrder, [order]],
  [
    'AdminOrdersQuery',
    AdminOrdersQuerySchema,
    { status: 'filled', limit: '200' },
    [{ limit: '201' }],
  ],
  ['AdminOrdersResponse', AdminOrdersResponseSchema, { items: [adminOrder] }, [{ items: [order] }]],
  [
    'AdminOrderStats',
    AdminOrderStatsSchema,
    {
      ordersToday: 2,
      fillRateBps: 5_000,
      rejectedBps: 5_000,
      notionalTodayCents: 1,
      activeTraders: 1,
      rejectionsByReason: [{ code: 'MARKET_CLOSED', count: 1 }],
      typeMix: [{ type: 'market', count: 2 }],
      amountOrders: 1,
    },
    [{ ordersToday: 2 }],
  ],
  ['AdminAccount', AdminAccountSchema, adminAccount, [{ ...adminAccount, positions: -1 }]],
  [
    'AdminAccountsQuery',
    AdminAccountsQuerySchema,
    { q: 'ACC', sort: 'equity', page: '2', pageSize: '50' },
    [{ sort: 'cash' }, { page: '0' }],
  ],
  [
    'AdminAccountsResponse',
    AdminAccountsResponseSchema,
    { items: [adminAccount], total: 1, page: 1, pageSize: 25 },
    [{ items: [adminAccount], total: 1, page: 0, pageSize: 25 }],
  ],
  ['ResetAccount', ResetAccountSchema, { confirm: 'RESET ACC-7F3A9C' }, [{ confirm: '  ' }]],
  [
    'AdminOrderEvent',
    AdminOrderEventSchema,
    { v: 1, order: adminOrder },
    [{ v: 2, order: adminOrder }],
  ],
  // Trading socket events.
  ['OrderUpdatedEvent', OrderUpdatedEventSchema, { v: 1, order }, [{ order }]],
  [
    'AlertTriggeredEvent',
    AlertTriggeredEventSchema,
    { v: 1, alert, lastTicks: 1 },
    [{ v: 1, alert, lastTicks: 0 }],
  ],
  ['NotificationEvent', NotificationEventSchema, { v: 1, notification }, [{ v: 1 }]],
  ['SymbolHaltedEvent', SymbolHaltedEventSchema, { v: 1, halt }, [{ v: 1, halt: {} }]],
  [
    'SymbolResumedEvent',
    SymbolResumedEventSchema,
    { v: 1, symbol: 'TSLA', at: 1 },
    [{ v: 1, symbol: 'tsla', at: 1 }],
  ],
  ['TradingStatusEvent', TradingStatusEventSchema, { v: 1, status }, [{ v: 1, status: {} }]],
  [
    'SocketAuth',
    SocketAuthSchema,
    { deviceId: '0b6b5f8e-6f1c-4c7e-9a52-3f0f1d6c2b11' },
    [{ deviceId: 'device-1' }],
  ],
  // Market socket events.
  ['QuotesEvent', QuotesEventSchema, [quote], [[{ ...quote, price: 0 }]]],
  ['SocketError', SocketErrorSchema, { code: 'X', message: 'y' }, [{ code: 'X' }]],
  // REST responses.
  ['StocksResponse', StocksResponseSchema, { items: [] }, [{}]],
  [
    'StockDetailResponse',
    StockDetailResponseSchema,
    {
      stock,
      quote,
      stats: { marketCap: 1, peRatio: null, week52High: 2, week52Low: 1, avgVolume: 5 },
    },
    [{ stock, quote }],
  ],
  ['CandlesQuery', CandlesQuerySchema, { period: '1W' }, [{ period: '2W' }]],
  [
    'CandlesResponse',
    CandlesResponseSchema,
    { symbol: 'AAPL', period: '1D', candles: [{ t: 1, o: 1, h: 2, l: 1, c: 2, v: 3 }] },
    [{ symbol: 'AAPL', period: '1D', candles: [{ t: 1, o: 0, h: 2, l: 1, c: 2, v: 3 }] }],
  ],
  ['WatchlistResponse', WatchlistResponseSchema, { symbols: ['AAPL'] }, [{ symbols: ['aapl'] }]],
  [
    'HealthResponse',
    HealthResponseSchema,
    { status: 'ok', uptimeSeconds: 3, version: '1.0.0', commit: 'dev' },
    [
      { status: 'ok', uptimeSeconds: 3 },
      { status: 'down', uptimeSeconds: 3, version: '1', commit: 'x' },
    ],
  ],
  [
    'Problem',
    ProblemSchema,
    { type: 'about:blank', title: 'Bad', status: 422, code: ErrorCode.ValidationFailed },
    [{ title: 'Bad', status: 422 }],
  ],
  // Admin responses.
  ['AdminUser', AdminUserSchema, adminUser, [{ ...adminUser, role: 'OWNER' }]],
  ['SessionResponse', SessionResponseSchema, { user: adminUser }, [adminUser]],
  [
    'CreateUser',
    CreateUserSchema,
    { email: 'sam@sarwa.dev', name: 'Sam', role: 'VIEWER', password: 'long-enough' },
    [{ email: 'sam', name: 'Sam', role: 'VIEWER', password: 'long-enough' }],
  ],
  ['UsersResponse', UsersResponseSchema, { items: [adminUser] }, [{ items: [{}] }]],
  [
    'MarketCommandResponse',
    MarketCommandResponseSchema,
    { status: { state: 'paused', volatility: 1, since: 1 }, dropped: 3 },
    [{ status: { state: 'stopped', volatility: 1, since: 1 } }],
  ],
  ['MarketState', MarketStateSchema, 'running', ['stopped']],
  [
    'AdminStock',
    AdminStockSchema,
    {
      ...stock,
      basePrice: 200,
      volatility: 1,
      marketCap: 1,
      peRatio: null,
      isEnabled: true,
      price: null,
      updatedAt: '2026-11-01T10:00:00.000Z',
    },
    [{ ...stock, basePrice: 0 }],
  ],
  ['AdminStocksResponse', AdminStocksResponseSchema, { items: [] }, [{ items: [stock] }]],
  ['AuditLog', AuditLogSchema, auditLog, [{ ...auditLog, action: 'stock.rename' }]],
  [
    'AuditPage',
    AuditPageSchema,
    { items: [auditLog], page: 1, pageSize: 25, total: 1 },
    [{ items: [auditLog], page: 1, pageSize: 25, total: -1 }],
  ],
  [
    'AdminStats',
    AdminStatsSchema,
    {
      connectedClients: 1,
      activeSubscriptions: 2,
      devices: 3,
      watchlistItems: 4,
      topWatchlisted: [{ symbol: 'AAPL', count: 2 }],
      market: {
        state: 'running',
        volatility: 1,
        since: 1,
        ticksPerSecond: 2,
        enabledSymbols: 10,
        totalSymbols: 12,
      },
      recentActivity: [auditLog],
    },
    [{ connectedClients: 1 }],
  ],
  ['Banner', BannerSchema, { message: 'Hi', tone: 'info' }, [{ message: 'Hi', tone: 'error' }]],
];

describe.each(cases)('%s', (_name, schema, valid, invalid) => {
  it('parses a valid value', () => {
    expect(schema.safeParse(valid).success).toBe(true);
  });

  it.each(invalid.map((value, i) => [i, value] as const))(
    'rejects invalid case %i',
    (_i, value) => {
      expect(schema.safeParse(value).success).toBe(false);
    },
  );
});

describe('request refinements', () => {
  const limitBuy = {
    symbol: 'AAPL',
    side: 'buy',
    type: 'limit',
    tif: 'gtc',
    size: { kind: 'shares', micros: 1 },
    limitTicks: 1,
    quotedTicks: 1,
  };

  it('refuses a stop price on a non-stop order', () => {
    const result = PlaceOrderRequestSchema.safeParse({ ...limitBuy, stopTicks: 1 });
    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toEqual(['stopTicks']);
  });

  it('accepts a quantity change alone', () => {
    expect(ModifyOrderRequestSchema.safeParse({ qtyMicros: 1 }).success).toBe(true);
  });

  it('defaults list queries from an empty query string', () => {
    expect(OrdersQuerySchema.parse({})).toEqual({ filter: 'all', limit: 50 });
    expect(NotificationsQuerySchema.parse({})).toEqual({ limit: 30 });
    expect(AdminAccountsQuerySchema.parse({})).toEqual({ sort: 'allTime', page: 1, pageSize: 25 });
  });
});

describe('wire constants', () => {
  it('names headers, namespaces and events the same on both sides', () => {
    expect({ API_PREFIX, DEVICE_ID_HEADER, IDEMPOTENCY_KEY_HEADER, ADMIN_SESSION_COOKIE }).toEqual({
      API_PREFIX: 'api/v1',
      DEVICE_ID_HEADER: 'x-device-id',
      IDEMPOTENCY_KEY_HEADER: 'idempotency-key',
      ADMIN_SESSION_COOKIE: 'sarwa_admin_session',
    });
    expect([MARKET_NAMESPACE, ADMIN_NAMESPACE]).toEqual(['/market', '/admin']);
    expect(Object.values(TradingSocketEvent)).toContain('order.updated');
    expect(Object.values(SocketEvent)).toContain('quotes');
    expect(Object.values(AdminSocketEvent)).toEqual(['admin.order', 'admin.trading']);
  });

  it('batches quotes no slower than the simulator ticks', () => {
    expect(QUOTE_BATCH_MS).toBeLessThanOrEqual(TICK_MS);
  });

  it('audits every admin action once', () => {
    expect(new Set(AUDIT_ACTIONS).size).toBe(AUDIT_ACTIONS.length);
  });
});

describe('ProblemSchema', () => {
  it('keeps the status and detail when the code is one this client does not know', () => {
    const problem = ProblemSchema.parse({
      type: 'about:blank',
      title: 'Teapot',
      status: 418,
      code: 'BREWING',
      detail: 'Short and stout',
    });

    expect(problem).toMatchObject({
      status: 418,
      code: ErrorCode.Internal,
      detail: 'Short and stout',
    });
  });
});

describe('enums', () => {
  it('mirror the domain lists value for value', () => {
    expect(SideSchema.options).toEqual([...SIDES]);
    expect(TimeInForceSchema.options).toEqual([...TIME_IN_FORCE]);
    expect(OrderStatusSchema.options).toEqual([...ORDER_STATUSES]);
    expect(SessionModeSchema.options).toEqual([...SESSION_MODES]);
    expect(SessionPhaseSchema.options).toEqual([...SESSION_PHASES]);
    expect(AlertConditionSchema.options).toEqual([...ALERT_CONDITIONS]);
    expect(AlertRepeatSchema.options).toEqual([...ALERT_REPEATS]);
    expect(AuditActionSchema.options).toEqual([...AUDIT_ACTIONS]);
  });

  it.each([
    [CancelOutcomeSchema, 'already_closed', 'lost'],
    [EquityPeriodSchema, 'ALL', '5Y'],
    [RoleSchema, 'VIEWER', 'OWNER'],
    [UserStatusSchema, 'disabled', 'banned'],
    [BannerToneSchema, 'warning', 'error'],
  ] as const)('accepts only listed values (%#)', (schema, valid, invalid) => {
    expect(schema.safeParse(valid).success).toBe(true);
    expect(schema.safeParse(invalid).success).toBe(false);
  });
});
