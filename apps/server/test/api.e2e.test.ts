import { randomUUID } from 'node:crypto';

import { type INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { type Application } from 'express';
import request from 'supertest';

import {
  ADMIN_SESSION_COOKIE,
  CandlesResponseSchema,
  DEVICE_ID_HEADER,
  HealthResponseSchema,
  InviteResponseSchema,
  ProblemSchema,
  StockDetailResponseSchema,
  StocksResponseSchema,
} from '@sarwa/contracts';
import { POLICY } from '@sarwa/domain';

import { PasswordHasher } from '../src/common/password-hasher';
import { PrismaService } from '../src/prisma.service';
import { AccountsService } from '../src/trading/accounts.service';
import { TradingEngine } from '../src/trading/engine.service';
import { GUEST_WATCHLIST_LIMIT } from '../src/watchlist/watchlist.service';
import { inviteAdmin } from './admins';
import { CapturingMailer, startApp } from './app';
import { bearer, type Customer, signUp } from './customers';

let app: INestApplication;
let http: ReturnType<typeof request>;
const mailer = new CapturingMailer();

beforeAll(async () => {
  ({ app } = await startApp({ mailer }));
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

  it('answers a repeated or oversized search with a validation problem, not a crash', async () => {
    const repeated = await http.get(api('/stocks?q=a&q=b')).expect(400);
    const oversized = await http.get(api(`/stocks?q=${'a'.repeat(100)}`)).expect(400);

    expect(ProblemSchema.parse(repeated.body).errors).toHaveProperty('q');
    expect(ProblemSchema.parse(oversized.body).code).toBe('VALIDATION_FAILED');
  });
});

describe("a device's guest account", () => {
  it('is opened only when asked for, once, with no user', async () => {
    const accounts = app.get(AccountsService);
    const deviceId = randomUUID();

    const before = await accounts.forDevice(deviceId, { create: false });
    const [opened, again] = await Promise.all([
      accounts.forDevice(deviceId, { create: true }),
      accounts.forDevice(deviceId, { create: true }),
    ]);

    expect(before).toBeNull();
    expect(
      await app.get(PrismaService).device.findUnique({ where: { id: deviceId } }),
    ).not.toBeNull();
    expect(opened).toMatchObject({
      deviceId,
      userId: null,
      cashCents: BigInt(POLICY.startingCashCents),
    });
    expect(again?.id).toBe(opened?.id);
  });
});

describe('watchlist', () => {
  let customer: Customer;
  const as = (req: request.Test) => req.set('Authorization', bearer(customer));

  beforeAll(async () => {
    customer = await signUp(http, { ip: '198.51.100.40' });
  });

  it('needs a signed-in customer or a device id', async () => {
    for (const req of [
      http.get(api('/watchlist')),
      http.put(api('/watchlist/AAPL')),
      http.delete(api('/watchlist/AAPL')),
      http.get(api('/watchlist')).set(DEVICE_ID_HEADER, 'not-a-uuid'),
    ]) {
      const res = await req.expect(401);
      expect(res.body).toMatchObject({ code: 'UNAUTHORIZED' });
    }
  });

  it("answers a stale token with 401, not the device's list", async () => {
    await http
      .get(api('/watchlist'))
      .set('Authorization', 'Bearer not-a-token')
      .set(DEVICE_ID_HEADER, randomUUID())
      .expect(401);
  });

  it("keeps a guest's stars on their device", async () => {
    const [device, other] = [randomUUID(), randomUUID()];
    const guest = (req: request.Test, id = device) => req.set(DEVICE_ID_HEADER, id);

    await guest(http.put(api('/watchlist/AAPL'))).expect(204);
    await guest(http.put(api('/watchlist/AAPL'))).expect(204);
    await guest(http.put(api('/watchlist/NVDA'))).expect(204);
    await guest(http.put(api('/watchlist/MSFT')), other).expect(204);
    await guest(http.delete(api('/watchlist/AAPL'))).expect(204);

    expect((await guest(http.get(api('/watchlist'))).expect(200)).body).toEqual({
      symbols: ['NVDA'],
    });
    expect((await guest(http.get(api('/watchlist')), other).expect(200)).body).toEqual({
      symbols: ['MSFT'],
    });
    expect(
      await app.get(PrismaService).account.findUnique({ where: { deviceId: device } }),
    ).toMatchObject({ userId: null });
  });

  it(`caps a guest at ${String(GUEST_WATCHLIST_LIMIT)} stars, but not a customer`, async () => {
    const prisma = app.get(PrismaService);
    const device = randomUUID();
    await http.put(api('/watchlist/AAPL')).set(DEVICE_ID_HEADER, device).expect(204);
    const { id } = await prisma.account.findUniqueOrThrow({ where: { deviceId: device } });
    const symbols = Array.from({ length: GUEST_WATCHLIST_LIMIT - 1 }, (_, i) => `ZZ${String(i)}`);
    await prisma.stock.createMany({
      data: symbols.map((symbol) => ({
        symbol,
        name: symbol,
        exchange: 'NASDAQ',
        sector: 'Test',
        basePrice: 1,
      })),
    });
    await prisma.watchlistItem.createMany({
      data: symbols.map((symbol) => ({ accountId: id, symbol })),
    });

    const full = await http.put(api('/watchlist/NVDA')).set(DEVICE_ID_HEADER, device).expect(409);
    await http.put(api('/watchlist/AAPL')).set(DEVICE_ID_HEADER, device).expect(204);
    await http.delete(api('/watchlist/AAPL')).set(DEVICE_ID_HEADER, device).expect(204);
    await http.put(api('/watchlist/NVDA')).set(DEVICE_ID_HEADER, device).expect(204);

    expect(ProblemSchema.parse(full.body).code).toBe('TOO_MANY_SYMBOLS');
    await prisma.stock.deleteMany({ where: { symbol: { in: symbols } } });
  });

  it('opens no account for a guest who only reads or unstars', async () => {
    const device = randomUUID();

    const list = await http.get(api('/watchlist')).set(DEVICE_ID_HEADER, device).expect(200);
    await http.delete(api('/watchlist/AAPL')).set(DEVICE_ID_HEADER, device).expect(204);

    expect(list.body).toEqual({ symbols: [] });
    expect(
      await app.get(PrismaService).account.findUnique({ where: { deviceId: device } }),
    ).toBeNull();
  });

  it("uses a signed-in customer's own account, whatever device they are on", async () => {
    const device = randomUUID();
    await as(http.put(api('/watchlist/AMZN')).set(DEVICE_ID_HEADER, device)).expect(204);

    const own = await as(http.get(api('/watchlist'))).expect(200);
    const res = await http.get(api('/watchlist')).set(DEVICE_ID_HEADER, device).expect(200);
    await as(http.delete(api('/watchlist/AMZN'))).expect(204);

    expect(own.body).toEqual({ symbols: ['AMZN'] });
    expect(res.body).toEqual({ symbols: [] });
  });

  it('adds, lists and removes symbols idempotently', async () => {
    await as(http.put(api('/watchlist/AAPL'))).expect(204);
    await as(http.put(api('/watchlist/AAPL'))).expect(204);
    await as(http.put(api('/watchlist/NVDA'))).expect(204);

    const list = await as(http.get(api('/watchlist'))).expect(200);
    expect(list.body).toEqual({ symbols: ['AAPL', 'NVDA'] });

    await as(http.delete(api('/watchlist/AAPL'))).expect(204);
    await as(http.delete(api('/watchlist/AAPL'))).expect(204);
    const after = await as(http.get(api('/watchlist'))).expect(200);
    expect(after.body).toEqual({ symbols: ['NVDA'] });
  });

  it('404s for a symbol that does not exist', async () => {
    await http.put(api('/watchlist/ZZZZ')).set('Authorization', bearer(customer)).expect(404);
  });

  it('404s for a stock the admin disabled', async () => {
    const cookie = await login('admin@sarwa.dev', 'admin12345', '198.51.100.10');
    await http
      .patch(api('/admin/stocks/INTC'))
      .set('Cookie', cookie)
      .send({ isEnabled: false })
      .expect(200);

    await as(http.put(api('/watchlist/INTC'))).expect(404);

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

  it('tags every response with a request id, reusing a sane incoming one', async () => {
    const fresh = await http.get(api('/health/live')).expect(200);
    const reused = await http.get(api('/health/live')).set('X-Request-Id', 'edge-1234').expect(200);
    const unsafe = await http
      .get(api('/health/live'))
      .set('X-Request-Id', 'not a safe id; drop table')
      .expect(200);

    expect(fresh.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(reused.headers['x-request-id']).toBe('edge-1234');
    expect(unsafe.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('lets a cross-origin client read the request id and Retry-After', async () => {
    const res = await http
      .get(api('/health/live'))
      .set('Origin', 'http://localhost:8081')
      .expect(200);

    expect(res.headers['access-control-expose-headers']).toBe('x-request-id,retry-after');
  });

  it('is live without touching the database', async () => {
    const query = jest.spyOn(app.get(PrismaService), '$queryRaw');

    const res = await http.get(api('/health/live')).expect(200);

    expect(res.body).toEqual({ status: 'ok' });
    expect(query).not.toHaveBeenCalled();
  });

  it('is ready once the database answers and the engine has loaded its book', async () => {
    const res = await http.get(api('/health/ready')).expect(200);

    expect(res.body).toEqual({ status: 'ok', checks: { database: 'ok', engine: 'ok' } });
  });

  it('is not ready while the database is down', async () => {
    jest.spyOn(app.get(PrismaService), '$queryRaw').mockRejectedValueOnce(new Error('db down'));

    const res = await http.get(api('/health/ready')).expect(503);

    expect(res.body.code).toBe('UNAVAILABLE');
  });

  it('is not ready before the engine has loaded the working orders', async () => {
    jest.spyOn(app.get(TradingEngine), 'isLoaded').mockReturnValue(false);

    await http.get(api('/health/ready')).expect(503);
    await http.get(api('/health')).expect(200);
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

  it('checks a password even for an unknown email so timing does not reveal accounts', async () => {
    const verify = jest.spyOn(app.get(PasswordHasher), 'verify');

    const res = await http
      .post(api('/admin/auth/login'))
      .set('X-Forwarded-For', '198.51.100.11')
      .send({ email: 'nobody@sarwa.dev', password: 'whatever-123' })
      .expect(401);

    expect(res.body.detail).toBe('Invalid email or password');
    expect(verify).toHaveBeenCalledWith(undefined, 'whatever-123');
  });

  it('upgrades a bcrypt admin password to argon2id at the next sign-in', async () => {
    const prisma = app.get(PrismaService);
    const email = `legacy-${randomUUID().slice(0, 8)}@sarwa.dev`;
    await prisma.adminUser.create({
      data: {
        email,
        name: 'Legacy',
        role: 'VIEWER',
        passwordHash: await bcrypt.hash('legacy-pass-1', 4),
      },
    });

    await login(email, 'legacy-pass-1', '198.51.100.31');

    const { passwordHash } = await prisma.adminUser.findUniqueOrThrow({ where: { email } });
    expect(passwordHash.startsWith('$argon2id$')).toBe(true);
    await login(email, 'legacy-pass-1', '198.51.100.32');
  });

  it('ends the session on sign-out, so a copied cookie stops working', async () => {
    const cookie = await login('admin@sarwa.dev', 'admin12345', '198.51.100.21');
    await http.get(api('/admin/auth/me')).set('Cookie', cookie).expect(200);

    await http.post(api('/admin/auth/logout')).set('Cookie', cookie).expect(204);

    await http.get(api('/admin/auth/me')).set('Cookie', cookie).expect(401);
    const fresh = await login('admin@sarwa.dev', 'admin12345', '198.51.100.22');
    const audit = await http
      .get(api('/admin/audit?action=auth.logout'))
      .set('Cookie', fresh)
      .expect(200);
    expect(audit.body.items[0]).toMatchObject({ actorEmail: 'admin@sarwa.dev' });
  });

  it('locks an account after 5 wrong passwords, even across IPs, and audits each failure', async () => {
    const admin = await login('admin@sarwa.dev', 'admin12345', '198.51.100.23');
    const { email, password } = await inviteAdmin(http, mailer, admin, 'VIEWER');

    for (let i = 0; i < 5; i++) {
      await http
        .post(api('/admin/auth/login'))
        .set('X-Forwarded-For', `198.51.101.${String(i + 1)}`)
        .send({ email, password: 'wrong-password' })
        .expect(401);
    }
    const locked = await http
      .post(api('/admin/auth/login'))
      .set('X-Forwarded-For', '198.51.101.99')
      .send({ email, password })
      .expect(401);

    expect(locked.body.detail).toBe('Invalid email or password');
    const audit = await http
      .get(api('/admin/audit?action=auth.login_failed&pageSize=100'))
      .set('Cookie', admin)
      .expect(200);
    const failures = (audit.body.items as { actorEmail: string }[]).filter(
      (item) => item.actorEmail === email,
    );
    expect(failures).toHaveLength(6);
  });

  it('refuses a session token that was not issued for the admin app', async () => {
    const user = await app.get(PrismaService).adminUser.findUniqueOrThrow({
      where: { email: 'admin@sarwa.dev' },
    });
    const foreign = await app.get(JwtService).signAsync({ sub: user.id }, { expiresIn: 60 });

    await http
      .get(api('/admin/auth/me'))
      .set('Cookie', `${ADMIN_SESSION_COOKIE}=${foreign}`)
      .expect(401);
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
    const { id, email } = await inviteAdmin(http, mailer, cookie, 'VIEWER');

    await http
      .patch(api(`/admin/users/${id}`))
      .set('Cookie', cookie)
      .send({ role: 'ADMIN', status: 'disabled' })
      .expect(200);

    const audit = await http.get(api('/admin/audit')).set('Cookie', cookie).expect(200);
    const forUser = (audit.body.items as { action: string; entity: string }[])
      .filter((item) => item.entity.endsWith(email))
      .map((item) => item.action)
      .sort();
    expect(forUser).toEqual(['user.invite', 'user.invite_accepted', 'user.role', 'user.status']);
  });

  it('rejects an oversized user id before touching the database', async () => {
    const cookie = await login('admin@sarwa.dev', 'admin12345', '198.51.100.13');

    const res = await http
      .patch(api(`/admin/users/${'x'.repeat(65)}`))
      .set('Cookie', cookie)
      .send({ role: 'ADMIN' })
      .expect(400);

    expect(ProblemSchema.parse(res.body).code).toBe('VALIDATION_FAILED');
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

  it('filters the audit log by group, with dropped connections under market', async () => {
    const cookie = await login('admin@sarwa.dev', 'admin12345', '198.51.100.60');
    await http
      .post(api('/admin/market'))
      .set('Cookie', cookie)
      .send({ action: 'dropConnections', confirm: 'DROP' })
      .expect(201);

    const market = await http
      .get(api('/admin/audit?group=market&pageSize=100'))
      .set('Cookie', cookie)
      .expect(200);
    const auth = await http
      .get(api('/admin/audit?group=auth&pageSize=100'))
      .set('Cookie', cookie)
      .expect(200);

    const actions = (page: request.Response) =>
      new Set((page.body.items as { action: string }[]).map((item) => item.action));
    expect(actions(market)).toContain('connections.drop');
    expect([...actions(market)].every((a) => /^(market|connections)\./.test(a))).toBe(true);
    expect([...actions(auth)].every((a) => a.startsWith('auth.'))).toBe(true);
    expect(actions(auth)).toContain('auth.login');
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

  it('refuses admin writes from another site but allows its own proxied origin', async () => {
    const cookie = await login('admin@sarwa.dev', 'admin12345', '198.51.100.7');
    const write = () =>
      http.patch(api('/admin/config')).set('Cookie', cookie).send({ maintenanceMode: false });

    const foreign = await write().set('Origin', 'https://evil.example').expect(403);
    await write().set('Sec-Fetch-Site', 'cross-site').expect(403);
    await write().set('Sec-Fetch-Site', 'same-site').expect(403);
    await http
      .post(api('/admin/auth/login'))
      .set('X-Forwarded-For', '198.51.100.8')
      .set('Origin', 'https://evil.example')
      .send({ email: 'admin@sarwa.dev', password: 'admin12345' })
      .expect(403);
    await http
      .get(api('/admin/stats'))
      .set('Cookie', cookie)
      .set('Origin', 'https://evil.example')
      .expect(200);
    await write()
      .set('Origin', 'http://admin.sarwa.test:3001')
      .set('X-Forwarded-Host', 'admin.sarwa.test:3001')
      .set('Sec-Fetch-Site', 'same-origin')
      .expect(200);

    expect(ProblemSchema.safeParse(foreign.body).success).toBe(true);
  });

  it('makes watchlists read-only during maintenance', async () => {
    const cookie = await login('admin@sarwa.dev', 'admin12345');
    await http
      .patch(api('/admin/config'))
      .set('Cookie', cookie)
      .send({ maintenanceMode: true })
      .expect(200);

    const customer = await signUp(http, { ip: '198.51.100.41' });
    const res = await http
      .put(api('/watchlist/AAPL'))
      .set('Authorization', bearer(customer))
      .expect(503);
    expect(res.body.code).toBe('MAINTENANCE');
    await http.delete(api('/watchlist/AAPL')).set('Authorization', bearer(customer)).expect(503);
    const device = randomUUID();
    await http.put(api('/watchlist/AAPL')).set(DEVICE_ID_HEADER, device).expect(503);
    await http.delete(api('/watchlist/AAPL')).set(DEVICE_ID_HEADER, device).expect(503);
    await http.get(api('/watchlist')).set(DEVICE_ID_HEADER, device).expect(200);

    await http
      .patch(api('/admin/config'))
      .set('Cookie', cookie)
      .send({ maintenanceMode: false })
      .expect(200);
  });
});

describe('team invites', () => {
  let admin: string;

  beforeAll(async () => {
    admin = await login('admin@sarwa.dev', 'admin12345', '198.51.100.50');
  });

  it('invites by an emailed 48-hour link that signs the new admin in once', async () => {
    const viewer = await login('viewer@sarwa.dev', 'viewer12345', '198.51.100.51');
    const email = `new-${randomUUID().slice(0, 8)}@sarwa.dev`;

    await http
      .post(api('/admin/invites'))
      .set('Cookie', viewer)
      .send({ email, role: 'ADMIN' })
      .expect(403);
    const created = await http
      .post(api('/admin/invites'))
      .set('Cookie', admin)
      .send({ email, role: 'VIEWER' })
      .expect(201);
    const token = mailer.tokenFor(email, 'admin_invite');
    const pending = await http.get(api('/admin/invites')).set('Cookie', admin).expect(200);
    const info = await http.get(api(`/admin/invites/token/${token}`)).expect(200);
    const accepted = await http
      .post(api('/admin/invites/accept'))
      .send({ token, name: 'New Analyst', password: 'analyst-pass-9' })
      .expect(201);
    const cookie = ([] as string[]).concat(accepted.headers['set-cookie'] ?? [])[0]!.split(';')[0]!;
    const again = await http
      .post(api('/admin/invites/accept'))
      .send({ token, name: 'Twice', password: 'analyst-pass-9' })
      .expect(410);

    expect(InviteResponseSchema.parse(created.body).invite).toMatchObject({
      email,
      role: 'VIEWER',
      invitedBy: 'admin@sarwa.dev',
      status: 'pending',
    });
    expect(mailer.sent.at(-1)?.link).toBe(`http://localhost:3001/invite/${token}`);
    expect(pending.body.items.map((i: { email: string }) => i.email)).toContain(email);
    expect(info.body).toMatchObject({ email, role: 'VIEWER' });
    expect(accepted.body.user).toMatchObject({ email, name: 'New Analyst', role: 'VIEWER' });
    expect(again.body.code).toBe('TOKEN_EXPIRED');
    await http.get(api('/admin/auth/me')).set('Cookie', cookie).expect(200);
    const audit = await http.get(api('/admin/audit?pageSize=100')).set('Cookie', admin).expect(200);
    const actions = (audit.body.items as { action: string; entity: string }[])
      .filter((item) => item.entity === `User · ${email}`)
      .map((item) => item.action)
      .sort();
    expect(actions).toEqual(['user.invite', 'user.invite_accepted']);
  });

  it('resends an invite with a fresh link that replaces the old one', async () => {
    const viewer = await login('viewer@sarwa.dev', 'viewer12345', '198.51.100.52');
    const email = `again-${randomUUID().slice(0, 8)}@sarwa.dev`;
    const created = await http
      .post(api('/admin/invites'))
      .set('Cookie', admin)
      .send({ email, role: 'VIEWER' })
      .expect(201);
    const first = mailer.tokenFor(email, 'admin_invite');
    const id = String(created.body.invite.id);

    await http
      .post(api(`/admin/invites/${id}/resend`))
      .set('Cookie', viewer)
      .expect(403);
    const resent = await http
      .post(api(`/admin/invites/${id}/resend`))
      .set('Cookie', admin)
      .expect(201);
    const second = mailer.tokenFor(email, 'admin_invite');
    await http
      .post(api(`/admin/invites/${id}/resend`))
      .set('Cookie', admin)
      .expect(404);

    expect(second).not.toBe(first);
    expect(InviteResponseSchema.parse(resent.body).invite).toMatchObject({ email, role: 'VIEWER' });
    expect(resent.body.invite.id).not.toBe(id);
    await http.get(api(`/admin/invites/token/${first}`)).expect(410);
    await http.get(api(`/admin/invites/token/${second}`)).expect(200);
  });

  it('refuses an email that already has an account, and revoked or expired links', async () => {
    const revokedEmail = `gone-${randomUUID().slice(0, 8)}@sarwa.dev`;
    const lateEmail = `late-${randomUUID().slice(0, 8)}@sarwa.dev`;

    await http
      .post(api('/admin/invites'))
      .set('Cookie', admin)
      .send({ email: 'viewer@sarwa.dev', role: 'ADMIN' })
      .expect(409);
    const revoked = await http
      .post(api('/admin/invites'))
      .set('Cookie', admin)
      .send({ email: revokedEmail, role: 'ADMIN' })
      .expect(201);
    await http
      .post(api('/admin/invites'))
      .set('Cookie', admin)
      .send({ email: lateEmail, role: 'ADMIN' })
      .expect(201);
    await http
      .delete(api(`/admin/invites/${String(revoked.body.invite.id)}`))
      .set('Cookie', admin)
      .expect(204);
    await app.get(PrismaService).adminInvite.updateMany({
      where: { email: lateEmail },
      data: { expiresAt: new Date(Date.now() - 1) },
    });

    await http
      .get(api(`/admin/invites/token/${mailer.tokenFor(revokedEmail, 'admin_invite')}`))
      .expect(410);
    await http
      .get(api(`/admin/invites/token/${mailer.tokenFor(lateEmail, 'admin_invite')}`))
      .expect(410);
    await http.post(api('/admin/users')).set('Cookie', admin).send({}).expect(404);
  });
});
