import { randomUUID } from 'node:crypto';

import { type INestApplication } from '@nestjs/common';
import request from 'supertest';

import {
  ADMIN_SESSION_COOKIE,
  CandlesResponseSchema,
  DEVICE_ID_HEADER,
  ProblemSchema,
  StockDetailResponseSchema,
  StocksResponseSchema,
} from '@sarwa/contracts';

import { startApp } from './app';

let app: INestApplication;
let http: ReturnType<typeof request>;

beforeAll(async () => {
  ({ app } = await startApp());
  http = request(app.getHttpServer());
});

afterAll(async () => {
  await app.close();
});

const api = (path: string) => `/api/v1${path}`;

async function login(email: string, password: string): Promise<string> {
  const res = await http.post(api('/admin/auth/login')).send({ email, password }).expect(200);
  const cookie = ([] as string[]).concat(res.headers['set-cookie'] ?? [])[0];
  expect(cookie).toContain(`${ADMIN_SESSION_COOKIE}=`);
  expect(cookie).toContain('HttpOnly');
  return cookie!.split(';')[0]!;
}

describe('public market API', () => {
  it('lists the seeded stocks with a quote, matching the contract', async () => {
    const res = await http.get(api('/stocks')).expect(200);
    const body = StocksResponseSchema.parse(res.body);
    expect(body.items).toHaveLength(22);
  });

  it('filters by symbol or company name', async () => {
    const res = await http.get(api('/stocks?q=apple')).expect(200);
    expect(StocksResponseSchema.parse(res.body).items.map((s) => s.symbol)).toEqual(['AAPL']);
  });

  it('returns stock detail with stats', async () => {
    const res = await http.get(api('/stocks/AAPL')).expect(200);
    expect(StockDetailResponseSchema.parse(res.body).stock.name).toBe('Apple Inc.');
  });

  it('returns candles that end at the live price', async () => {
    const [detail, candles] = await Promise.all([
      http.get(api('/stocks/MSFT')),
      http.get(api('/stocks/MSFT/candles?period=1W')),
    ]);
    const body = CandlesResponseSchema.parse(candles.body);
    expect(body.candles).toHaveLength(168);
    expect(body.candles.at(-1)?.c).toBeCloseTo(
      StockDetailResponseSchema.parse(detail.body).quote.price,
      0,
    );
  });

  it('answers unknown symbols and bad periods with problem details', async () => {
    const notFound = await http.get(api('/stocks/ZZZZ')).expect(404);
    expect(ProblemSchema.parse(notFound.body).code).toBe('NOT_FOUND');

    const invalid = await http.get(api('/stocks/AAPL/candles?period=5Y')).expect(400);
    expect(ProblemSchema.parse(invalid.body).errors).toHaveProperty('period');
  });
});

describe('watchlist', () => {
  const deviceId = randomUUID();

  it('rejects requests without a valid device id', async () => {
    const res = await http.get(api('/watchlist')).expect(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('adds, lists and removes symbols idempotently', async () => {
    await http.put(api('/watchlist/AAPL')).set(DEVICE_ID_HEADER, deviceId).expect(204);
    await http.put(api('/watchlist/AAPL')).set(DEVICE_ID_HEADER, deviceId).expect(204);
    await http.put(api('/watchlist/NVDA')).set(DEVICE_ID_HEADER, deviceId).expect(204);

    const list = await http.get(api('/watchlist')).set(DEVICE_ID_HEADER, deviceId).expect(200);
    expect(list.body).toEqual({ symbols: ['AAPL', 'NVDA'] });

    await http.delete(api('/watchlist/AAPL')).set(DEVICE_ID_HEADER, deviceId).expect(204);
    await http.delete(api('/watchlist/AAPL')).set(DEVICE_ID_HEADER, deviceId).expect(204);
    const after = await http.get(api('/watchlist')).set(DEVICE_ID_HEADER, deviceId).expect(200);
    expect(after.body).toEqual({ symbols: ['NVDA'] });
  });

  it('404s for a symbol that does not exist', async () => {
    await http.put(api('/watchlist/ZZZZ')).set(DEVICE_ID_HEADER, deviceId).expect(404);
  });
});

describe('admin', () => {
  it('rejects a wrong password with a generic message', async () => {
    const res = await http
      .post(api('/admin/auth/login'))
      .send({ email: 'admin@sarwa.dev', password: 'wrong-password' })
      .expect(401);
    expect(res.body.detail).toBe('Invalid email or password');
  });

  it('requires a session for admin routes', async () => {
    await http.get(api('/admin/stats')).expect(401);
  });

  it('lets an ADMIN pause the market and records it in the audit log', async () => {
    const cookie = await login('admin@sarwa.dev', 'admin12345');

    const res = await http
      .post(api('/admin/market'))
      .set('Cookie', cookie)
      .send({ action: 'pause' })
      .expect(201);
    expect(res.body.status.state).toBe('paused');
    await http
      .post(api('/admin/market'))
      .set('Cookie', cookie)
      .send({ action: 'resume' })
      .expect(201);

    const audit = await http
      .get(api('/admin/audit?action=market.pause'))
      .set('Cookie', cookie)
      .expect(200);
    expect(audit.body.items[0]).toMatchObject({
      actorEmail: 'admin@sarwa.dev',
      action: 'market.pause',
    });
  });

  it('lets a VIEWER read but not change anything', async () => {
    const cookie = await login('viewer@sarwa.dev', 'viewer12345');

    await http.get(api('/admin/stats')).set('Cookie', cookie).expect(200);
    const res = await http
      .post(api('/admin/market'))
      .set('Cookie', cookie)
      .send({ action: 'pause' })
      .expect(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('hides a disabled stock from the public API', async () => {
    const cookie = await login('admin@sarwa.dev', 'admin12345');

    await http
      .patch(api('/admin/stocks/INTC'))
      .set('Cookie', cookie)
      .send({ isEnabled: false })
      .expect(200);
    await http.get(api('/stocks/INTC')).expect(404);

    await http
      .patch(api('/admin/stocks/INTC'))
      .set('Cookie', cookie)
      .send({ isEnabled: true })
      .expect(200);
    await http.get(api('/stocks/INTC')).expect(200);
  });

  it('makes watchlists read-only during maintenance', async () => {
    const cookie = await login('admin@sarwa.dev', 'admin12345');
    await http
      .patch(api('/admin/config'))
      .set('Cookie', cookie)
      .send({ maintenanceMode: true })
      .expect(200);

    const res = await http
      .put(api('/watchlist/AAPL'))
      .set(DEVICE_ID_HEADER, randomUUID())
      .expect(503);
    expect(res.body.code).toBe('MAINTENANCE');

    await http
      .patch(api('/admin/config'))
      .set('Cookie', cookie)
      .send({ maintenanceMode: false })
      .expect(200);
  });
});
