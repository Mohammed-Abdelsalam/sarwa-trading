import { DEVICE_ID_HEADER, IDEMPOTENCY_KEY_HEADER } from '@sarwa/contracts';

import { createApiClient } from '../src/api';
import { makeAlert, makeOrder, makePortfolio, makeTradingStatus } from './trading-fixtures';

const DEVICE_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

interface Call {
  path: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

function fakeServer(bodies: Record<string, unknown>) {
  const calls: Call[] = [];
  global.fetch = jest.fn((url: string, init: RequestInit) => {
    const path = url.replace('http://api/api/v1', '');
    const method = init.method ?? 'GET';
    calls.push({
      path,
      method,
      headers: init.headers as Record<string, string>,
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
    });
    const body = bodies[`${method} ${path}`];
    return Promise.resolve({
      ok: true,
      status: body === undefined ? 204 : 200,
      json: () => Promise.resolve(body),
    });
  }) as unknown as typeof fetch;
  return calls;
}

const api = createApiClient({
  baseUrl: 'http://api',
  getDeviceId: () => Promise.resolve(DEVICE_ID),
});

describe('trading api', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('places an order with a JSON body, the idempotency key and the device id', async () => {
    const calls = fakeServer({ 'POST /orders': { order: makeOrder() } });
    const request = {
      symbol: 'AAPL',
      side: 'buy',
      type: 'market',
      tif: 'day',
      size: { kind: 'amount', cents: 10_000 },
      quotedTicks: 2_315_000,
    } as const;

    const order = await api.placeOrder(request, 'key-12345678');

    expect(order).toEqual(makeOrder());
    expect(calls[0]).toMatchObject({ method: 'POST', path: '/orders', body: request });
    expect(calls[0]?.headers).toMatchObject({
      [IDEMPOTENCY_KEY_HEADER]: 'key-12345678',
      [DEVICE_ID_HEADER]: DEVICE_ID,
      'Content-Type': 'application/json',
    });
  });

  it('rejects a response that does not match the contract', async () => {
    fakeServer({ 'GET /portfolio': { ...makePortfolio(), holds: 'none' } });

    await expect(api.getPortfolio()).rejects.toThrow();
  });

  it('calls every trading endpoint with the right path and method and parses the answers', async () => {
    const order = makeOrder();
    const calls = fakeServer({
      'GET /account': makePortfolio().account,
      'GET /portfolio': makePortfolio(),
      'GET /portfolio/equity?period=1M': { period: '1M', points: [{ t: 1, equityCents: 5 }] },
      'GET /orders?filter=open&symbol=AAPL': { items: [order], nextCursor: null },
      'GET /orders': { items: [], nextCursor: null },
      'GET /orders/ord-1': { order },
      'POST /orders/ord-1/cancel': { outcome: 'already_filled', order },
      'PATCH /orders/ord-1': { order },
      'GET /alerts': { items: [makeAlert()], activeCount: 1, limit: 50 },
      'POST /alerts': { alert: makeAlert() },
      'PATCH /alerts/al-1': { alert: makeAlert({ enabled: false }) },
      'GET /notifications': { items: [], nextCursor: null, unreadCount: 0 },
      'GET /notifications?cursor=n-9&limit=10': { items: [], nextCursor: null, unreadCount: 0 },
      'GET /trading/status': makeTradingStatus(),
    });

    await api.getAccount();
    await api.getPortfolio();
    await expect(api.getEquity('1M')).resolves.toMatchObject({ period: '1M' });
    await expect(api.listOrders({ filter: 'open', symbol: 'AAPL' })).resolves.toMatchObject({
      items: [order],
    });
    await api.listOrders();
    await expect(api.getOrder('ord-1')).resolves.toEqual(order);
    await expect(api.cancelOrder('ord-1')).resolves.toMatchObject({ outcome: 'already_filled' });
    await expect(api.modifyOrder('ord-1', { limitTicks: 2_000_000 })).resolves.toEqual(order);
    await api.listAlerts();
    await api.createAlert({
      symbol: 'AAPL',
      condition: 'price_above',
      thresholdTicks: 2_500_000,
      repeat: 'once',
    });
    await expect(api.updateAlert('al-1', { enabled: false })).resolves.toMatchObject({
      enabled: false,
    });
    await api.deleteAlert('al-1');
    await api.listNotifications();
    await api.listNotifications({ cursor: 'n-9', limit: 10 });
    await api.markNotificationRead('n-1');
    await api.markAllNotificationsRead();
    await api.registerPushToken({ token: 'tok', platform: 'ios' });
    await expect(api.getTradingStatus()).resolves.toEqual(makeTradingStatus());

    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      'GET /account',
      'GET /portfolio',
      'GET /portfolio/equity?period=1M',
      'GET /orders?filter=open&symbol=AAPL',
      'GET /orders',
      'GET /orders/ord-1',
      'POST /orders/ord-1/cancel',
      'PATCH /orders/ord-1',
      'GET /alerts',
      'POST /alerts',
      'PATCH /alerts/al-1',
      'DELETE /alerts/al-1',
      'GET /notifications',
      'GET /notifications?cursor=n-9&limit=10',
      'POST /notifications/n-1/read',
      'POST /notifications/read-all',
      'POST /push-tokens',
      'GET /trading/status',
    ]);
    expect(calls.find((c) => c.path === '/push-tokens')?.body).toEqual({
      token: 'tok',
      platform: 'ios',
    });
  });
});
