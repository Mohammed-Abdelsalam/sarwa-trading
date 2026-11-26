import { randomUUID } from 'node:crypto';

import { type INestApplication } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { type Application } from 'express';
import request from 'supertest';

import {
  ADMIN_SESSION_COOKIE,
  CandlesResponseSchema,
  DEVICE_ID_HEADER,
  HealthResponseSchema,
  ProblemSchema,
  StockDetailResponseSchema,
  StocksResponseSchema,
} from '@sarwa/contracts';

import { PrismaService } from '../src/prisma.service';
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

// supertest connects over loopback like the admin proxy, so each test can log in from its own forwarded IP.
async function login(email: string, password: string, ip = '127.0.0.1'): Promise<string> {
  const res = await http
    .post(api('/admin/auth/login'))
    .set('X-Forwarded-For', ip)
    .send({ email, password })
    .expect(200);
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

  it('404s for a stock the admin disabled', async () => {
    const cookie = await login('admin@sarwa.dev', 'admin12345', '198.51.100.10');
    await http
      .patch(api('/admin/stocks/INTC'))
      .set('Cookie', cookie)
      .send({ isEnabled: false })
      .expect(200);

    await http.put(api('/watchlist/INTC')).set(DEVICE_ID_HEADER, deviceId).expect(404);

    await http
      .patch(api('/admin/stocks/INTC'))
      .set('Cookie', cookie)
      .send({ isEnabled: true })
      .expect(200);
  });
});

describe('health', () => {
  it('reports ok when the database answers', async () => {
    const res = await http.get(api('/health')).expect(200);
    expect(HealthResponseSchema.safeParse(res.body).success).toBe(true);
  });

  it('answers 503 problem details when the database is down', async () => {
    jest.spyOn(app.get(PrismaService), '$queryRaw').mockRejectedValueOnce(new Error('db down'));

    const res = await http.get(api('/health')).expect(503);

    expect(ProblemSchema.safeParse(res.body).success).toBe(true);
    expect(res.body.code).toBe('UNAVAILABLE');
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

  it('runs bcrypt even for an unknown email so timing does not reveal accounts', async () => {
    const compare = jest.spyOn(bcrypt, 'compare');

    const res = await http
      .post(api('/admin/auth/login'))
      .set('X-Forwarded-For', '198.51.100.11')
      .send({ email: 'nobody@sarwa.dev', password: 'whatever-123' })
      .expect(401);

    expect(res.body.detail).toBe('Invalid email or password');
    expect(compare).toHaveBeenCalledTimes(1);
  });

  it('trusts X-Forwarded-For only from the local admin proxy', () => {
    const trusts = (app.getHttpAdapter().getInstance() as Application).get('trust proxy fn') as (
      address: string,
      hop: number,
    ) => boolean;

    expect(trusts('127.0.0.1', 0)).toBe(true);
    expect(trusts('192.168.1.20', 0)).toBe(false);
  });

  it('records the client IP forwarded by the admin proxy', async () => {
    const cookie = await login('admin@sarwa.dev', 'admin12345', '203.0.113.7');

    const audit = await http
      .get(api('/admin/audit?action=auth.login'))
      .set('Cookie', cookie)
      .expect(200);

    expect(audit.body.items[0]).toMatchObject({ action: 'auth.login', ip: '203.0.113.7' });
  });

  it('logs one audit entry per field when role and status change together', async () => {
    const cookie = await login('admin@sarwa.dev', 'admin12345', '198.51.100.12');
    const email = `analyst-${randomUUID().slice(0, 8)}@sarwa.dev`;
    const created = await http
      .post(api('/admin/users'))
      .set('Cookie', cookie)
      .send({ email, name: 'Analyst', role: 'VIEWER', password: 'analyst12345' })
      .expect(201);

    await http
      .patch(api(`/admin/users/${String(created.body.id)}`))
      .set('Cookie', cookie)
      .send({ role: 'ADMIN', status: 'disabled' })
      .expect(200);

    const audit = await http.get(api('/admin/audit')).set('Cookie', cookie).expect(200);
    const forUser = (audit.body.items as { action: string; entity: string }[])
      .filter((item) => item.entity.endsWith(email))
      .map((item) => item.action)
      .sort();
    expect(forUser).toEqual(['user.create', 'user.role', 'user.status']);
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
