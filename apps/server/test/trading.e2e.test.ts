import { randomUUID } from 'node:crypto';

import { type INestApplication } from '@nestjs/common';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';

import {
  ADMIN_NAMESPACE,
  ADMIN_SESSION_COOKIE,
  AdminOrderStatsSchema,
  AlertResponseSchema,
  CancelOrderResponseSchema,
  DEVICE_ID_HEADER,
  EquityResponseSchema,
  MARKET_NAMESPACE,
  NotificationsResponseSchema,
  type Order,
  OrdersResponseSchema,
  PlaceOrderResponseSchema,
  PortfolioResponseSchema,
  resetConfirmation,
  TradingStatusSchema,
} from '@sarwa/contracts';
import {
  averageCostTicks,
  bps,
  cents,
  DEFAULT_EXECUTION_RULES,
  dollarsToTicks,
  micros,
  notionalCents,
  orderExpiry,
  POLICY,
  scaleBps,
  sharesForCents,
  sharesToMicros,
  spreadAround,
} from '@sarwa/domain';

import { MarketService } from '../src/market/market.service';
import { PrismaService } from '../src/prisma.service';
import { TradingEngine } from '../src/trading/engine.service';
import { ExecutionService } from '../src/trading/execution.service';
import { OrdersService } from '../src/trading/orders.service';
import { PortfolioService } from '../src/trading/portfolio.service';
import { FakeClock, startApp } from './app';

// Tuesday 1 Dec 2026, 10:00 in New York: a regular session in calendar mode.
const T0 = Date.UTC(2026, 11, 1, 15, 0);
const SATURDAY = Date.UTC(2026, 11, 5, 15, 0);
const SPREAD_BPS = bps(2);
const DISPLAYED_SHARES = 900;

const clock = new FakeClock(T0);
let app: INestApplication;
let url: string;
let http: ReturnType<typeof request>;
let market: MarketService;
let engine: TradingEngine;
let adminCookie: string;
let viewerCookie: string;
let ipCounter = 10;

const api = (path: string) => `/api/v1${path}`;
const nextIp = () => `198.18.${Math.floor(ipCounter / 250)}.${String((ipCounter++ % 250) + 1)}`;

interface Device {
  id: string;
  ip: string;
}

const newDevice = (): Device => ({ id: randomUUID(), ip: nextIp() });
const key = () => randomUUID().replaceAll('-', '');

const get = (device: Device, path: string) =>
  http.get(api(path)).set(DEVICE_ID_HEADER, device.id).set('X-Forwarded-For', device.ip);
const post = (device: Device, path: string, body?: object) =>
  http
    .post(api(path))
    .set(DEVICE_ID_HEADER, device.id)
    .set('X-Forwarded-For', device.ip)
    .send(body);

function place(device: Device, body: object, idempotencyKey = key()) {
  return post(device, '/orders', body).set('Idempotency-Key', idempotencyKey);
}

const marketBuy = (symbol: string, size: object, quotedTicks: number) => ({
  symbol,
  side: 'buy',
  type: 'market',
  tif: 'day',
  size,
  quotedTicks,
});

async function placed(device: Device, body: object): Promise<Order> {
  const res = await place(device, body).expect(201);
  return PlaceOrderResponseSchema.parse(res.body).order;
}

// Moves the price and waits until the engine has processed the quote.
async function moveTo(symbol: string, price: number): Promise<void> {
  market.movePrice(symbol, price);
  await engine.idle();
}

async function orderOf(device: Device, id: string): Promise<Order> {
  return PlaceOrderResponseSchema.parse((await get(device, `/orders/${id}`).expect(200)).body)
    .order;
}

async function portfolio(device: Device) {
  return PortfolioResponseSchema.parse((await get(device, '/portfolio').expect(200)).body);
}

async function login(email: string, password: string, remember = false): Promise<string> {
  const res = await http
    .post(api('/admin/auth/login'))
    .set('X-Forwarded-For', nextIp())
    .send({ email, password, remember })
    .expect(200);
  const cookie = ([] as string[]).concat(res.headers['set-cookie'] ?? [])[0]!;
  return cookie.split(';')[0]!;
}

const admin = (method: 'get' | 'post' | 'patch' | 'delete', path: string, cookie = adminCookie) =>
  http[method](api(path)).set('Cookie', cookie).set('X-Forwarded-For', '127.0.0.1');

async function newAdmin(role: 'ADMIN' | 'VIEWER'): Promise<{ id: string; cookie: string }> {
  const email = `user-${randomUUID().slice(0, 8)}@sarwa.dev`;
  const res = await admin('post', '/admin/users')
    .send({ email, name: 'Ops', role, password: 'user12345678' })
    .expect(201);
  return { id: res.body.id as string, cookie: await login(email, 'user12345678') };
}

function waitFor<T>(socket: Socket, event: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`No ${event} event`));
    }, 3_000);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

async function connect(namespace: string, options: object): Promise<Socket> {
  const socket = io(`${url}${namespace}`, {
    transports: ['websocket'],
    forceNew: true,
    ...options,
  });
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
  return socket;
}

beforeAll(async () => {
  ({ app, url } = await startApp({ clock }));
  http = request(app.getHttpServer());
  market = app.get(MarketService);
  engine = app.get(TradingEngine);
  // No random walk and no random slippage: every price in these tests is set explicitly.
  market.random = () => 0.99;
  app.get(ExecutionService).random = () => 0;
  adminCookie = await login('admin@sarwa.dev', 'admin12345');
  viewerCookie = await login('viewer@sarwa.dev', 'viewer12345');
  await admin('patch', '/admin/trading')
    .send({ circuitBreaker: { enabled: false } })
    .expect(200);
});

afterAll(async () => {
  await app.close();
});

describe('market orders', () => {
  it('fills a $500 market buy at the ask and balances the books', async () => {
    const device = newDevice();
    await moveTo('AAPL', 200);
    const { askTicks } = spreadAround(dollarsToTicks(200), SPREAD_BPS);
    const qty = sharesForCents(cents(50_000), askTicks);
    const cost = notionalCents(qty, askTicks, 'up');

    const order = await placed(
      device,
      marketBuy('AAPL', { kind: 'amount', cents: 50_000 }, dollarsToTicks(200)),
    );

    expect(order).toMatchObject({
      status: 'filled',
      qtyMicros: qty,
      filledMicros: qty,
      filledNotionalCents: cost,
      heldCents: 0,
    });
    expect(cost).toBeLessThanOrEqual(50_000);
    const books = await portfolio(device);
    expect(books.account.cashCents).toBe(POLICY.startingCashCents - cost);
    expect(books.positions).toEqual([
      expect.objectContaining({ symbol: 'AAPL', qtyMicros: qty, costBasisCents: cost }),
    ]);
    const [held] = books.positions;
    expect(
      averageCostTicks({
        qtyMicros: micros(held!.qtyMicros),
        costBasisCents: cents(held!.costBasisCents),
      }),
    ).toBe(askTicks);
    expect(books.holds).toEqual([]);
    await engine.idle();
    const inbox = NotificationsResponseSchema.parse((await get(device, '/notifications')).body);
    expect(inbox.items[0]?.payload).toMatchObject({
      kind: 'order_filled',
      qtyMicros: qty,
      notionalCents: cost,
    });
  });

  it('answers a cancel after the fill with already_filled', async () => {
    const device = newDevice();
    await moveTo('KO', 70);
    const order = await placed(
      device,
      marketBuy('KO', { kind: 'shares', micros: sharesToMicros(2) }, dollarsToTicks(70)),
    );

    const res = await post(device, `/orders/${order.id}/cancel`).expect(200);

    expect(CancelOrderResponseSchema.parse(res.body)).toMatchObject({
      outcome: 'already_filled',
      order: { id: order.id, status: 'filled' },
    });
  });
});

describe('limit orders', () => {
  it('rests a limit sell above the market, fills it by displayed size, then fully', async () => {
    const device = newDevice();
    await moveTo('PFE', 25);
    const bought = await placed(
      device,
      marketBuy('PFE', { kind: 'shares', micros: sharesToMicros(1_000) }, dollarsToTicks(25)),
    );
    const sell = await placed(device, {
      symbol: 'PFE',
      side: 'sell',
      type: 'limit',
      tif: 'gtc',
      size: { kind: 'shares', micros: sharesToMicros(1_000) },
      limitTicks: dollarsToTicks(26),
      quotedTicks: dollarsToTicks(25),
    });
    expect(sell).toMatchObject({ status: 'open', heldMicros: sharesToMicros(1_000) });

    await moveTo('PFE', 26.1);
    const partial = (await get(device, `/orders/${sell.id}`).expect(200)).body.order as Order;
    expect(partial).toMatchObject({
      status: 'partially_filled',
      filledMicros: sharesToMicros(DISPLAYED_SHARES),
      heldMicros: sharesToMicros(1_000 - DISPLAYED_SHARES),
    });

    await engine.idle();
    const inbox = NotificationsResponseSchema.parse((await get(device, '/notifications')).body);
    expect(inbox.items[0]?.payload).toMatchObject({
      kind: 'order_partially_filled',
      qtyMicros: sharesToMicros(DISPLAYED_SHARES),
      notionalCents: partial.fills[0]?.notionalCents,
    });

    await moveTo('PFE', 26.2);
    const done = (await get(device, `/orders/${sell.id}`).expect(200)).body.order as Order;
    expect(done.status).toBe('filled');
    expect(done.fills).toHaveLength(2);

    const books = await portfolio(device);
    const realized = done.fills.reduce((sum, fill) => sum + fill.realizedCents, 0);
    expect(books.positions).toEqual([]);
    expect(books.realizedYtdCents).toBe(realized);
    expect(realized).toBe(done.filledNotionalCents - bought.filledNotionalCents);
    expect(books.account.cashCents).toBe(POLICY.startingCashCents + realized);
  });
});

describe('rejections', () => {
  const buyOne = () =>
    marketBuy('INTC', { kind: 'shares', micros: sharesToMicros(1) }, dollarsToTicks(23));

  beforeAll(async () => {
    await moveTo('INTC', 23);
  });

  it('stores a rejected order when the kill switch is off', async () => {
    await admin('patch', '/admin/trading').send({ tradingEnabled: false }).expect(200);
    const order = await placed(newDevice(), buyOne());
    await admin('patch', '/admin/trading').send({ tradingEnabled: true }).expect(200);

    expect(order).toMatchObject({ status: 'rejected', rejection: { code: 'TRADING_DISABLED' } });
  });

  it('stores a rejected order while the market is paused', async () => {
    await admin('post', '/admin/market').send({ action: 'pause' }).expect(201);
    const order = await placed(newDevice(), buyOne());
    await admin('post', '/admin/market').send({ action: 'resume' }).expect(201);

    expect(order).toMatchObject({ status: 'rejected', rejection: { code: 'MARKET_PAUSED' } });
  });

  it('halts a symbol, tells everyone, rejects orders and resumes', async () => {
    const device = newDevice();
    const socket = await connect(MARKET_NAMESPACE, { auth: { deviceId: device.id } });
    const halted = waitFor<{ v: number; halt: { symbol: string } }>(socket, 'symbol.halted');

    await admin('post', '/admin/halts')
      .send({ symbol: 'INTC', message: 'News pending', duration: '15m', notify: false })
      .expect(201);
    expect(await halted).toMatchObject({ v: 1, halt: { symbol: 'INTC', source: 'admin' } });
    const rejected = await placed(device, buyOne());
    const status = TradingStatusSchema.parse((await get(device, '/trading/status')).body);

    const resumed = waitFor<{ symbol: string }>(socket, 'symbol.resumed');
    await admin('post', '/admin/halts/INTC/resume').expect(204);
    await resumed;
    const accepted = await placed(device, buyOne());
    socket.disconnect();

    expect(rejected).toMatchObject({ status: 'rejected', rejection: { code: 'SYMBOL_HALTED' } });
    expect(status.halts.map((h) => h.symbol)).toContain('INTC');
    expect(accepted.status).toBe('filled');
  });
});

describe('closed market', () => {
  afterEach(async () => {
    clock.set(T0);
    await admin('patch', '/admin/trading').send({ sessionMode: 'always-open' }).expect(200);
  });

  it('queues a market order with the closed-market buffer hold and releases it on cancel', async () => {
    const device = newDevice();
    await moveTo('KO', 70);
    await admin('patch', '/admin/trading').send({ sessionMode: 'calendar' }).expect(200);
    clock.set(SATURDAY);
    const qty = sharesToMicros(10);
    const { askTicks } = spreadAround(dollarsToTicks(70), SPREAD_BPS);
    const hold = notionalCents(qty, scaleBps(askTicks, bps(500), 'up'), 'up');

    const order = await placed(
      device,
      marketBuy('KO', { kind: 'shares', micros: qty }, dollarsToTicks(70)),
    );
    const before = await portfolio(device);
    const canceled = CancelOrderResponseSchema.parse(
      (await post(device, `/orders/${order.id}/cancel`).expect(200)).body,
    );
    const after = await portfolio(device);

    expect(order).toMatchObject({ status: 'queued', heldCents: hold });
    expect(before.holds).toEqual([expect.objectContaining({ orderId: order.id, heldCents: hold })]);
    expect(canceled).toMatchObject({
      outcome: 'canceled',
      order: { status: 'canceled', heldCents: 0, cancelReason: 'user' },
    });
    expect(after.holds).toEqual([]);
    expect(after.account.cashCents).toBe(POLICY.startingCashCents);
  });
});

describe('idempotency', () => {
  const body = marketBuy('BAC', { kind: 'shares', micros: sharesToMicros(3) }, dollarsToTicks(45));

  beforeAll(async () => {
    await moveTo('BAC', 45);
  });

  it('places one order for a retried key and replays it with 200', async () => {
    const device = newDevice();
    const idempotencyKey = key();

    const first = await place(device, body, idempotencyKey).expect(201);
    const second = await place(device, body, idempotencyKey).expect(200);
    const list = OrdersResponseSchema.parse((await get(device, '/orders').expect(200)).body);

    expect(second.body.order.id).toBe(first.body.order.id);
    expect(list.items).toHaveLength(1);
  });

  it('rejects the same key with a different body', async () => {
    const device = newDevice();
    const idempotencyKey = key();
    await place(device, body, idempotencyKey).expect(201);

    const res = await place(
      device,
      { ...body, size: { kind: 'shares', micros: sharesToMicros(4) } },
      idempotencyKey,
    ).expect(422);

    expect(res.body.code).toBe('IDEMPOTENCY_MISMATCH');
  });

  it('requires the Idempotency-Key header', async () => {
    const res = await post(newDevice(), '/orders', body).expect(400);
    expect(res.body.errors).toHaveProperty('Idempotency-Key');
  });
});

describe('expiry', () => {
  afterEach(() => {
    clock.set(T0);
  });

  it('expires a day limit order at New York midnight and releases its hold', async () => {
    const device = newDevice();
    await moveTo('DIS', 110);
    const order = await placed(device, {
      symbol: 'DIS',
      side: 'buy',
      type: 'limit',
      tif: 'day',
      size: { kind: 'shares', micros: sharesToMicros(5) },
      limitTicks: dollarsToTicks(105),
      quotedTicks: dollarsToTicks(110),
    });

    clock.set(order.expiresAt!);
    engine.scheduleHousekeeping();
    await engine.idle();
    const expired = (await get(device, `/orders/${order.id}`).expect(200)).body.order as Order;
    const inbox = NotificationsResponseSchema.parse((await get(device, '/notifications')).body);

    expect(expired).toMatchObject({ status: 'expired', heldCents: 0 });
    expect(inbox.items[0]?.payload).toMatchObject({ kind: 'order_expired', orderId: order.id });
  });

  it('never fills a day order past its expiry, even before housekeeping runs', async () => {
    const device = newDevice();
    await moveTo('NFLX', 600);
    const order = await placed(device, {
      symbol: 'NFLX',
      side: 'buy',
      type: 'limit',
      tif: 'day',
      size: { kind: 'shares', micros: sharesToMicros(1) },
      limitTicks: dollarsToTicks(590),
      quotedTicks: dollarsToTicks(600),
    });

    clock.set(order.expiresAt!);
    await moveTo('NFLX', 580);
    const after = await orderOf(device, order.id);

    expect(after.filledMicros).toBe(0);
  });

  it('gives a market order the day expiry so a stuck one releases its hold', async () => {
    const device = newDevice();
    await moveTo('TSLA', 250);
    jest.spyOn(app.get(ExecutionService), 'work').mockResolvedValueOnce(micros(0));

    const order = await placed(
      device,
      marketBuy('TSLA', { kind: 'shares', micros: sharesToMicros(1) }, dollarsToTicks(250)),
    );

    expect(order).toMatchObject({
      status: 'open',
      expiresAt: orderExpiry('day', T0, 'always-open'),
    });
  });
});

describe('displayed size', () => {
  afterEach(() => {
    clock.set(T0);
  });

  it("shares one quote's displayed size between resting limits, oldest first", async () => {
    const device = newDevice();
    await moveTo('V', 30);
    const limitBuy = async () => {
      clock.advance(1);
      return placed(device, {
        symbol: 'V',
        side: 'buy',
        type: 'limit',
        tif: 'gtc',
        size: { kind: 'shares', micros: sharesToMicros(400) },
        limitTicks: dollarsToTicks(29),
        quotedTicks: dollarsToTicks(30),
      });
    };
    const orders = [await limitBuy(), await limitBuy(), await limitBuy()];

    await moveTo('V', 28);
    const filled = await Promise.all(
      orders.map(async (order) => (await orderOf(device, order.id)).filledMicros),
    );

    expect(filled).toEqual([sharesToMicros(400), sharesToMicros(400), sharesToMicros(100)]);
  });
});

describe('changing a partly filled buy', () => {
  it('holds the rest at the new price after the limit is lowered', async () => {
    const device = newDevice();
    await moveTo('JPM', 21);
    const order = await placed(device, {
      symbol: 'JPM',
      side: 'buy',
      type: 'limit',
      tif: 'gtc',
      size: { kind: 'shares', micros: sharesToMicros(1_000) },
      limitTicks: dollarsToTicks(20),
      quotedTicks: dollarsToTicks(21),
    });
    await moveTo('JPM', 19.9);

    await http
      .patch(api(`/orders/${order.id}`))
      .set(DEVICE_ID_HEADER, device.id)
      .set('X-Forwarded-For', device.ip)
      .send({ qtyMicros: sharesToMicros(2_000), limitTicks: dollarsToTicks(18) })
      .expect(200);
    await moveTo('JPM', 17.9);
    const after = await orderOf(device, order.id);

    expect(after).toMatchObject({
      status: 'partially_filled',
      filledMicros: sharesToMicros(1_800),
      heldCents: notionalCents(sharesToMicros(200), dollarsToTicks(18), 'up'),
    });
  });
});

describe('requests that waited in the queue', () => {
  const staleAccount = async (device: Device) => {
    await get(device, '/account').expect(200);
    return app.get(PrismaService).account.findUniqueOrThrow({ where: { deviceId: device.id } });
  };
  const changeAccount = (id: string, data: object) =>
    app.get(PrismaService).account.update({ where: { id }, data });

  it('places with the account as it is when the order runs', async () => {
    const device = newDevice();
    await moveTo('GOOGL', 150);
    const stale = await staleAccount(device);
    await changeAccount(stale.id, { epoch: { increment: 1 }, cashCents: 1_000n });

    const { order } = await app.get(OrdersService).place(
      stale,
      key(),
      'hash',
      {
        symbol: 'GOOGL',
        side: 'buy',
        type: 'market',
        tif: 'day',
        size: { kind: 'shares', micros: sharesToMicros(1) },
        quotedTicks: dollarsToTicks(150),
      },
      performance.now(),
    );
    const row = await app.get(PrismaService).order.findUniqueOrThrow({ where: { id: order.id } });

    expect(order.rejection?.code).toBe('INSUFFICIENT_FUNDS');
    expect(row.epoch).toBe(stale.epoch + 1);
  });

  it('changes an order against the account as it is when the change runs', async () => {
    const device = newDevice();
    await moveTo('GOOGL', 150);
    const resting = await placed(device, {
      symbol: 'GOOGL',
      side: 'buy',
      type: 'limit',
      tif: 'gtc',
      size: { kind: 'shares', micros: sharesToMicros(1) },
      limitTicks: dollarsToTicks(140),
      quotedTicks: dollarsToTicks(150),
    });
    const stale = await staleAccount(device);
    await changeAccount(stale.id, { cashCents: 20_000n });

    await expect(
      app.get(OrdersService).modify(stale, resting.id, { qtyMicros: sharesToMicros(10) }),
    ).rejects.toMatchObject({ response: { code: 'INSUFFICIENT_FUNDS' } });
  });

  it('reads cash and positions from the same moment', async () => {
    const device = newDevice();
    await moveTo('META', 300);
    const stale = await staleAccount(device);
    await placed(
      device,
      marketBuy('META', { kind: 'shares', micros: sharesToMicros(10) }, dollarsToTicks(300)),
    );

    const books = await app.get(PortfolioService).books(stale);

    expect(books.account.cashCents).toBe(
      POLICY.startingCashCents - books.positions[0]!.costBasisCents,
    );
  });

  it('values a position with no quote at its average cost', async () => {
    const device = newDevice();
    await moveTo('AMZN', 180);
    await placed(
      device,
      marketBuy('AMZN', { kind: 'shares', micros: sharesToMicros(10) }, dollarsToTicks(180)),
    );
    const account = await staleAccount(device);
    jest.spyOn(market, 'quoteOf').mockReturnValue(undefined);

    const summary = await app.get(PortfolioService).summary(account);

    expect(Math.abs(summary.equityCents - POLICY.startingCashCents)).toBeLessThanOrEqual(1);
  });
});

describe('alerts', () => {
  afterEach(() => {
    clock.set(T0);
  });

  it('fires once on the crossing and re-arms only after crossing back and the cooldown', async () => {
    const device = newDevice();
    await moveTo('MSFT', 400);
    const socket = await connect(MARKET_NAMESPACE, { auth: { deviceId: device.id } });
    const { alert: created } = AlertResponseSchema.parse(
      (
        await post(device, '/alerts', {
          symbol: 'MSFT',
          condition: 'price_above',
          thresholdTicks: dollarsToTicks(410),
          repeat: 'every',
        }).expect(201)
      ).body,
    );
    const triggered = waitFor<{ v: number; alert: { id: string } }>(socket, 'alert.triggered');

    await moveTo('MSFT', 411);
    const event = await triggered;
    await moveTo('MSFT', 415);
    await moveTo('MSFT', 405);
    await moveTo('MSFT', 412);
    const beforeCooldown = NotificationsResponseSchema.parse(
      (await get(device, '/notifications')).body,
    );
    clock.advance(POLICY.alertCooldownMs);
    await moveTo('MSFT', 405);
    await moveTo('MSFT', 412);
    const after = NotificationsResponseSchema.parse((await get(device, '/notifications')).body);
    socket.disconnect();

    expect(event).toMatchObject({ v: 1, alert: { id: created.id } });
    expect(beforeCooldown.items.filter((n) => n.payload.kind === 'alert_triggered')).toHaveLength(
      1,
    );
    expect(after.items.filter((n) => n.payload.kind === 'alert_triggered')).toHaveLength(2);
    expect(after.unreadCount).toBe(2);
  });

  it('refuses an alert that is already true', async () => {
    await moveTo('MSFT', 400);
    const res = await post(newDevice(), '/alerts', {
      symbol: 'MSFT',
      condition: 'price_below',
      thresholdTicks: dollarsToTicks(410),
      repeat: 'once',
    }).expect(422);
    expect(res.body.code).toBe('ALREADY_BELOW');
  });
});

describe('circuit breaker', () => {
  afterEach(async () => {
    clock.set(T0);
    await admin('post', '/admin/halts/CVX/resume');
    await admin('patch', '/admin/trading')
      .send({ circuitBreaker: { enabled: false } })
      .expect(200);
  });

  it('halts a symbol that moves 10% within the window', async () => {
    await admin('patch', '/admin/trading')
      .send({ circuitBreaker: { enabled: true } })
      .expect(200);
    await moveTo('CVX', 150);
    clock.advance(2_000);
    await moveTo('CVX', 166);

    const trading = (await admin('get', '/admin/trading').expect(200)).body;

    expect(trading.halts).toEqual([
      expect.objectContaining({
        symbol: 'CVX',
        source: 'circuit_breaker',
        message: 'Circuit breaker · moved +10.7% in 5 min',
      }),
    ]);
    expect(trading.tripsToday).toEqual([expect.objectContaining({ symbol: 'CVX' })]);
  });
});

describe('admin', () => {
  it('lets a viewer read but not change trading, halts, resets or users', async () => {
    await admin('get', '/admin/trading', viewerCookie).expect(200);
    await admin('get', '/admin/orders', viewerCookie).expect(200);
    await admin('patch', '/admin/trading', viewerCookie)
      .send({ tradingEnabled: false })
      .expect(403);
    await admin('post', '/admin/halts', viewerCookie)
      .send({ symbol: 'AAPL', message: 'x', duration: '5m', notify: false })
      .expect(403);
    await admin('post', '/admin/accounts/any/reset', viewerCookie)
      .send({ confirm: 'x' })
      .expect(403);
    const users = await admin('get', '/admin/users', viewerCookie).expect(403);
    expect(users.body.code).toBe('FORBIDDEN');
  });

  it('resets an account only with the exact confirmation and audits before and after', async () => {
    const device = newDevice();
    await moveTo('NKE', 80);
    await placed(
      device,
      marketBuy('NKE', { kind: 'shares', micros: sharesToMicros(10) }, dollarsToTicks(80)),
    );
    const resting = await placed(device, {
      symbol: 'NKE',
      side: 'buy',
      type: 'limit',
      tif: 'gtc',
      size: { kind: 'shares', micros: sharesToMicros(10) },
      limitTicks: dollarsToTicks(75),
      quotedTicks: dollarsToTicks(80),
    });
    const { handle } = (await get(device, '/account').expect(200)).body as { handle: string };
    const list = await admin('get', `/admin/accounts?q=${handle}`).expect(200);
    const id = list.body.items[0].id as string;
    expect(list.body.items[0]).toMatchObject({ handle, positions: 1, openOrders: 1 });

    await admin('post', `/admin/accounts/${id}/reset`).send({ confirm: handle }).expect(422);
    await admin('post', `/admin/accounts/${id}/reset`)
      .send({ confirm: resetConfirmation(handle) })
      .expect(200);

    const books = await portfolio(device);
    const canceled = (await get(device, `/orders/${resting.id}`).expect(200)).body.order as Order;
    const audit = await admin('get', '/admin/audit?action=account.reset').expect(200);
    expect(books.account.cashCents).toBe(POLICY.startingCashCents);
    expect(books.positions).toEqual([]);
    expect(canceled).toMatchObject({ status: 'canceled', cancelReason: 'admin_reset' });
    expect(audit.body.items[0]).toMatchObject({
      entity: `Account · ${handle}`,
      payload: {
        before: expect.objectContaining({
          positions: [expect.objectContaining({ symbol: 'NKE' })],
        }),
        after: expect.objectContaining({ cashCents: POLICY.startingCashCents, positions: [] }),
      },
    });
  });

  it('streams order changes to signed-in admins only', async () => {
    await expect(connect(ADMIN_NAMESPACE, {})).rejects.toThrow();
    const socket = await connect(ADMIN_NAMESPACE, { extraHeaders: { cookie: adminCookie } });
    const event = waitFor<{ v: number; order: { accountHandle: string } }>(socket, 'admin.order');

    await moveTo('WMT', 86);
    await placed(
      newDevice(),
      marketBuy('WMT', { kind: 'shares', micros: sharesToMicros(1) }, dollarsToTicks(86)),
    );
    const received = await event;
    socket.disconnect();

    expect(received.v).toBe(1);
    expect(received.order.accountHandle).toMatch(/^ACC-[0-9A-F]{6}$/);
  });

  it('records trading changes with before and after', async () => {
    await admin('patch', '/admin/trading')
      .send({ rules: { maxSlippageBps: 6 } })
      .expect(200);
    await admin('patch', '/admin/trading')
      .send({ rules: { maxSlippageBps: 5 } })
      .expect(200);

    const audit = await admin('get', '/admin/audit?action=trading.update').expect(200);

    expect(audit.body.items[0].payload).toMatchObject({
      before: { rules: expect.objectContaining({ maxSlippageBps: 6 }) },
      after: { rules: expect.objectContaining({ maxSlippageBps: 5 }) },
    });
  });

  it('refuses a min notional patch that is not below the saved max', async () => {
    const res = await admin('patch', '/admin/trading')
      .send({ rules: { minNotionalCents: DEFAULT_EXECUTION_RULES.maxNotionalCents } })
      .expect(400);

    expect(res.body.code).toBe('VALIDATION_FAILED');
  });

  it('answers 404 for a user that does not exist', async () => {
    const res = await admin('patch', '/admin/users/missing').send({ status: 'disabled' });

    expect(res.status).toBe(404);
  });

  it('keeps one active ADMIN when the last two demote each other at once', async () => {
    const prisma = app.get(PrismaService);
    const [b, c] = await Promise.all([newAdmin('ADMIN'), newAdmin('ADMIN')]);
    const others = await prisma.adminUser.findMany({
      where: { role: 'ADMIN', status: 'active', id: { notIn: [b.id, c.id] } },
    });
    await prisma.adminUser.updateMany({
      where: { id: { in: others.map((o) => o.id) } },
      data: { status: 'disabled' },
    });

    await Promise.all([
      admin('patch', `/admin/users/${c.id}`, b.cookie).send({ role: 'VIEWER' }),
      admin('patch', `/admin/users/${b.id}`, c.cookie).send({ role: 'VIEWER' }),
    ]);
    const activeAdmins = await prisma.adminUser.count({
      where: { role: 'ADMIN', status: 'active' },
    });
    await prisma.adminUser.updateMany({
      where: { id: { in: others.map((o) => o.id) } },
      data: { status: 'active' },
    });

    expect(activeAdmins).toBe(1);
  });

  it('drops the live socket of an admin who is disabled or demoted', async () => {
    const viewer = await newAdmin('VIEWER');
    const demoted = await newAdmin('ADMIN');
    const sockets = await Promise.all(
      [viewer, demoted].map((user) =>
        connect(ADMIN_NAMESPACE, { extraHeaders: { cookie: user.cookie } }),
      ),
    );
    const dropped = sockets.map((socket) => waitFor<string>(socket, 'disconnect'));

    await admin('patch', `/admin/users/${viewer.id}`).send({ status: 'disabled' }).expect(200);
    await admin('patch', `/admin/users/${demoted.id}`).send({ role: 'VIEWER' }).expect(200);

    await expect(Promise.all(dropped)).resolves.toHaveLength(2);
    for (const socket of sockets) socket.disconnect();
  });

  it('refuses to delete a stock with trading history', async () => {
    const res = await admin('delete', '/admin/stocks/AAPL').expect(409);
    expect(res.body).toMatchObject({ code: 'CONFLICT', detail: 'Disable the stock instead' });
  });

  it('keeps the session for 7 days when asked to remember', async () => {
    const res = await http
      .post(api('/admin/auth/login'))
      .set('X-Forwarded-For', nextIp())
      .send({ email: 'viewer@sarwa.dev', password: 'viewer12345', remember: true })
      .expect(200);
    const cookie = ([] as string[]).concat(res.headers['set-cookie'] ?? [])[0]!;
    expect(cookie).toContain(`${ADMIN_SESSION_COOKIE}=`);
    expect(cookie).toContain(`Max-Age=${7 * 24 * 60 * 60}`);
  });
});

describe('portfolio history and stats', () => {
  afterEach(() => {
    clock.set(T0);
  });

  it('records equity snapshots and ends the curve at the live equity', async () => {
    const device = newDevice();
    await moveTo('JNJ', 150);
    await placed(
      device,
      marketBuy('JNJ', { kind: 'shares', micros: sharesToMicros(10) }, dollarsToTicks(150)),
    );
    clock.advance(60_000);
    const snapshots = await app.get(PortfolioService).takeSnapshots();
    clock.advance(60_000);
    await moveTo('JNJ', 160);

    const res = await get(device, '/portfolio/equity?period=1D').expect(200);
    const books = await portfolio(device);

    const { points } = EquityResponseSchema.parse(res.body);
    const position = books.positions[0]!;
    expect(snapshots).toBeGreaterThan(0);
    expect(points).toHaveLength(3);
    expect(points[0]?.equityCents).toBe(POLICY.startingCashCents);
    expect(points.at(-1)?.equityCents).toBe(
      books.account.cashCents +
        notionalCents(micros(position.qtyMicros), dollarsToTicks(160), 'nearest'),
    );
  });

  it("reports today's order stats for the admin dashboard", async () => {
    const res = await admin('get', '/admin/orders/stats').expect(200);
    const stats = AdminOrderStatsSchema.parse(res.body);

    expect(stats.ordersToday).toBeGreaterThan(0);
    expect(stats.activeTraders).toBeGreaterThan(0);
    expect(stats.rejectionsByReason.map((r) => r.code)).toContain('SYMBOL_HALTED');
  });
});

describe('storage', () => {
  it('runs SQLite in WAL mode', async () => {
    const rows = await app
      .get(PrismaService)
      .$queryRawUnsafe<{ journal_mode: string }[]>('PRAGMA journal_mode');
    expect(rows[0]?.journal_mode).toBe('wal');
  });
});
