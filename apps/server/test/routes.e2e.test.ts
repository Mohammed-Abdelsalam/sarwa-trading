import { randomUUID } from 'node:crypto';

import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { type z } from 'zod';

import {
  AccountSchema,
  AlertResponseSchema,
  AlertsResponseSchema,
  CancelOrderResponseSchema,
  DEVICE_ID_HEADER,
  EquityResponseSchema,
  HealthResponseSchema,
  IDEMPOTENCY_KEY_HEADER,
  NotificationsResponseSchema,
  OrdersResponseSchema,
  PlaceOrderResponseSchema,
  PortfolioResponseSchema,
  routePath,
  TRADING_ROUTES,
  TradingStatusSchema,
} from '@sarwa/contracts';
import { dollarsToTicks } from '@sarwa/domain';

import { MarketService } from '../src/market/market.service';
import { TradingEngine } from '../src/trading/engine.service';
import { TradingConfigService } from '../src/trading-config/trading-config.service';
import { FakeClock, pinned, startApp } from './app';

// Every device endpoint, called through the shared route table and parsed with the schema the
// core API client parses it with, so a path or shape drift fails here before it reaches a client.

// Tuesday 1 Dec 2026, 10:00 in New York: a regular session in calendar mode.
const T0 = Date.UTC(2026, 11, 1, 15, 0);
const R = TRADING_ROUTES;

const clock = new FakeClock(T0);
let app: INestApplication;
let http: ReturnType<typeof request>;
let market: MarketService;
let engine: TradingEngine;
const device = randomUUID();
const covered = new Set<string>();

type Method = 'get' | 'post' | 'patch' | 'delete';

async function call<S extends z.ZodType>(
  method: Method,
  route: keyof typeof R,
  path: string,
  schema: S,
  { body, status = method === 'post' ? 201 : 200 }: { body?: object; status?: number } = {},
): Promise<z.output<S>> {
  covered.add(`${method} ${route}`);
  let req = http[method](`/api/v1${path}`)
    .set(DEVICE_ID_HEADER, device)
    .set('X-Forwarded-For', '198.19.0.1');
  if (route === 'orders' && method === 'post') {
    req = req.set(IDEMPOTENCY_KEY_HEADER, randomUUID().replaceAll('-', ''));
  }
  const res = await req.send(body).expect(status);
  return schema.parse(res.body);
}

const noContent = (method: Method, route: keyof typeof R, path: string, body?: object) =>
  call(method, route, path, { parse: () => undefined } as unknown as z.ZodType, {
    body,
    status: 204,
  });

const marketBuy = {
  symbol: 'AAPL',
  side: 'buy',
  type: 'market',
  tif: 'day',
  size: { kind: 'amount', cents: 50_000 },
};

const limitBuy = (limitTicks: number, quotedTicks: number) => ({
  symbol: 'AAPL',
  side: 'buy',
  type: 'limit',
  tif: 'gtc',
  size: { kind: 'shares', micros: 1_000_000 },
  limitTicks,
  quotedTicks,
});

beforeAll(async () => {
  ({ app } = await startApp({ clock, ...pinned }));
  http = request(app.getHttpServer());
  market = app.get(MarketService);
  engine = app.get(TradingEngine);
  await app
    .get(TradingConfigService)
    .update({ circuitBreaker: { enabled: false } }, { email: 'test@sarwa.dev' });
  market.movePrice('AAPL', 200);
  await engine.idle();
});

afterAll(async () => {
  await app.close();
});

describe('device endpoints', () => {
  it('answers every read with the shape the client parses', async () => {
    const account = await call('get', 'account', routePath(R.account), AccountSchema);
    const books = await call('get', 'portfolio', routePath(R.portfolio), PortfolioResponseSchema);
    const equity = await call(
      'get',
      'equity',
      `${routePath(R.equity)}?period=1M`,
      EquityResponseSchema,
    );
    const status = await call(
      'get',
      'tradingStatus',
      routePath(R.tradingStatus),
      TradingStatusSchema,
    );

    expect(books.account.id).toBe(account.id);
    expect(equity.period).toBe('1M');
    expect(status.session.isOpen).toBe(true);
  });

  it('places, lists, reads, modifies and cancels an order', async () => {
    const quoted = dollarsToTicks(200);
    const { order } = await call('post', 'orders', routePath(R.orders), PlaceOrderResponseSchema, {
      body: limitBuy(dollarsToTicks(190), quoted),
    });
    const id = order.id;

    const list = await call(
      'get',
      'orders',
      `${routePath(R.orders)}?filter=open`,
      OrdersResponseSchema,
    );
    const read = await call('get', 'order', routePath(R.order, { id }), PlaceOrderResponseSchema);
    const modified = await call(
      'patch',
      'order',
      routePath(R.order, { id }),
      PlaceOrderResponseSchema,
      { body: { limitTicks: dollarsToTicks(185) } },
    );
    const canceled = await call(
      'post',
      'cancelOrder',
      routePath(R.cancelOrder, { id }),
      CancelOrderResponseSchema,
      { status: 200 },
    );

    expect(list.items.map((item) => item.id)).toContain(id);
    expect(read.order.id).toBe(id);
    expect(modified.order.limitTicks).toBe(dollarsToTicks(185));
    expect(canceled).toMatchObject({ outcome: 'canceled', order: { id, status: 'canceled' } });
  });

  it('creates, lists, updates and deletes an alert', async () => {
    const { alert } = await call('post', 'alerts', routePath(R.alerts), AlertResponseSchema, {
      body: {
        symbol: 'AAPL',
        condition: 'price_above',
        thresholdTicks: dollarsToTicks(250),
        repeat: 'once',
      },
    });
    const list = await call('get', 'alerts', routePath(R.alerts), AlertsResponseSchema);
    const updated = await call(
      'patch',
      'alert',
      routePath(R.alert, { id: alert.id }),
      AlertResponseSchema,
      { body: { enabled: false } },
    );
    await noContent('delete', 'alert', routePath(R.alert, { id: alert.id }));

    expect(list.items.map((item) => item.id)).toContain(alert.id);
    expect(updated.alert).toMatchObject({ id: alert.id, enabled: false });
  });

  it('pages notifications by cursor and marks them read', async () => {
    const path = routePath(R.notifications);
    for (let i = 0; i < 2; i += 1) {
      await call('post', 'orders', routePath(R.orders), PlaceOrderResponseSchema, {
        body: { ...marketBuy, quotedTicks: dollarsToTicks(200) },
      });
    }
    await engine.idle();
    const first = await call(
      'get',
      'notifications',
      `${path}?limit=1`,
      NotificationsResponseSchema,
    );
    const second = await call(
      'get',
      'notifications',
      `${path}?limit=1&cursor=${first.nextCursor ?? ''}`,
      NotificationsResponseSchema,
    );
    const id = first.items[0]!.id;

    await noContent('post', 'notificationRead', routePath(R.notificationRead, { id }));
    const afterOne = await call('get', 'notifications', path, NotificationsResponseSchema);
    await noContent('post', 'notificationsReadAll', routePath(R.notificationsReadAll));
    const afterAll = await call('get', 'notifications', path, NotificationsResponseSchema);

    expect(first.items).toHaveLength(1);
    expect(first.nextCursor).toBe(id);
    expect(second.items).toHaveLength(1);
    expect(second.items[0]!.id).not.toBe(id);
    expect(afterOne.unreadCount).toBe(first.unreadCount - 1);
    expect(afterAll.unreadCount).toBe(0);
  });

  it('registers a push token', async () => {
    await expect(
      noContent('post', 'pushTokens', routePath(R.pushTokens), {
        token: `ExponentPushToken[${randomUUID()}]`,
        platform: 'ios',
      }),
    ).resolves.toBeUndefined();
  });

  it('exercised every route in the table', () => {
    const routes = new Set([...covered].map((entry) => entry.split(' ')[1]));
    expect([...routes].sort()).toEqual(Object.keys(R).sort());
  });
});

describe('health', () => {
  it('reports the running build', async () => {
    const res = await http.get('/api/v1/health').expect(200);
    const health = HealthResponseSchema.parse(res.body);
    expect(health.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(health.commit).toBe(process.env.GIT_SHA ? process.env.GIT_SHA.slice(0, 7) : 'dev');
  });
});
