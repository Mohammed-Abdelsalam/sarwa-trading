import { randomUUID } from 'node:crypto';

import { type INestApplication } from '@nestjs/common';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';

import {
  AdminStatsSchema,
  CustomerActivityResponseSchema,
  CustomerDetailSchema,
  CustomerKpisSchema,
  CustomerRevealResponseSchema,
  CustomerSessionsResponseSchema,
  CustomersResponseSchema,
  DEVICE_ID_HEADER,
  HaltImpactSchema,
  MARKET_NAMESPACE,
  OrdersResponseSchema,
  resetConfirmation,
  SessionRevokedEventSchema,
} from '@sarwa/contracts';
import { dollarsToTicks } from '@sarwa/domain';

import { MarketService } from '../src/market/market.service';
import { PrismaService } from '../src/prisma.service';
import { CapturingMailer, FakeClock, pinned, startApp } from './app';
import { bearer, type Customer, PASSWORD, signUp, uniqueEmail } from './customers';

const clock = new FakeClock(Date.now());
const mailer = new CapturingMailer();
let app: INestApplication;
let url: string;
let http: ReturnType<typeof request>;
let prisma: PrismaService;
let adminCookie: string;
let viewerCookie: string;
let ipCounter = 1;

const api = (path: string) => `/api/v1${path}`;
const nextIp = () =>
  `198.18.${String(100 + Math.floor(ipCounter / 250))}.${String((ipCounter++ % 250) + 1)}`;
const reason = 'Automated trading scripts detected';

async function login(email: string, password: string): Promise<string> {
  const res = await http
    .post(api('/admin/auth/login'))
    .set('X-Forwarded-For', nextIp())
    .send({ email, password })
    .expect(200);
  return ([] as string[]).concat(res.headers['set-cookie'] ?? [])[0]!.split(';')[0]!;
}

const asAdmin = (method: 'get' | 'post', path: string, cookie = adminCookie) =>
  http[method](api(path)).set('Cookie', cookie);

// A limit 5% under the market: it rests, holding cash, until canceled.
function restingBuy(customer: Customer) {
  const price = dollarsToTicks(app.get(MarketService).quoteOf('KO')!.price);
  return http
    .post(api('/orders'))
    .set('Authorization', bearer(customer))
    .set('Idempotency-Key', randomUUID().replaceAll('-', ''))
    .send({
      symbol: 'KO',
      side: 'buy',
      type: 'limit',
      tif: 'gtc',
      size: { kind: 'shares', micros: 1_000_000 },
      limitTicks: Math.round(price * 0.95),
      quotedTicks: price,
    })
    .expect(201)
    .expect((res) => {
      expect(res.body.order.status).toBe('open');
    });
}

beforeAll(async () => {
  ({ app, url } = await startApp({ clock, mailer, ...pinned }));
  http = request(app.getHttpServer());
  prisma = app.get(PrismaService);
  adminCookie = await login('admin@sarwa.dev', 'admin12345');
  viewerCookie = await login('viewer@sarwa.dev', 'viewer12345');
});

afterAll(async () => {
  await app.close();
});

describe('the customers list', () => {
  let sara: Customer;
  let omar: Customer;

  beforeAll(async () => {
    sara = await signUp(http, { ip: nextIp(), name: 'Sara Hamdy', email: uniqueEmail('sara') });
    omar = await signUp(http, { ip: nextIp(), name: 'Omar Fathy', platform: 'android' });
    await restingBuy(omar);
    await prisma.user.update({ where: { id: sara.userId }, data: { emailVerifiedAt: new Date() } });
  });

  it('finds customers by email, name or account id, with their books', async () => {
    const byEmail = CustomersResponseSchema.parse(
      (await asAdmin('get', `/admin/customers?q=${sara.email.slice(0, 12)}`).expect(200)).body,
    );
    const byName = CustomersResponseSchema.parse(
      (await asAdmin('get', '/admin/customers?q=omar fathy').expect(200)).body,
    );
    const byHandle = CustomersResponseSchema.parse(
      (await asAdmin('get', `/admin/customers?q=${omar.handle.toLowerCase()}`).expect(200)).body,
    );

    expect(byEmail.items.map((c) => c.handle)).toEqual([sara.handle]);
    expect(byName.items[0]).toMatchObject({
      handle: omar.handle,
      openOrders: 1,
      signupPlatform: 'android',
    });
    expect(byHandle.items).toHaveLength(1);
    expect(byEmail.items[0]).toMatchObject({
      email: sara.email,
      name: 'Sara Hamdy',
      status: 'active',
      emailVerified: true,
      equityCents: 10_000_000,
    });
  });

  it('filters by verified and open orders, and pages by cursor', async () => {
    const verified = CustomersResponseSchema.parse(
      (await asAdmin('get', '/admin/customers?verified=true&limit=100').expect(200)).body,
    );
    const withOrders = CustomersResponseSchema.parse(
      (await asAdmin('get', '/admin/customers?hasOpenOrders=true&limit=100').expect(200)).body,
    );
    const first = CustomersResponseSchema.parse(
      (await asAdmin('get', '/admin/customers?limit=1').expect(200)).body,
    );
    const second = CustomersResponseSchema.parse(
      (await asAdmin('get', `/admin/customers?limit=1&cursor=${first.nextCursor!}`).expect(200))
        .body,
    );

    expect(verified.items.every((c) => c.emailVerified)).toBe(true);
    expect(verified.items.map((c) => c.handle)).toContain(sara.handle);
    expect(withOrders.items.map((c) => c.handle)).toEqual(expect.arrayContaining([omar.handle]));
    expect(withOrders.items.map((c) => c.handle)).not.toContain(sara.handle);
    expect(first.total).toBeGreaterThanOrEqual(2);
    expect(second.items[0]!.id).not.toBe(first.items[0]!.id);
  });

  it('masks emails for VIEWER', async () => {
    const res = CustomersResponseSchema.parse(
      (await asAdmin('get', `/admin/customers?q=${sara.handle}`, viewerCookie).expect(200)).body,
    );

    expect(res.items[0]!.email).toBe(`s•••@example.com`);
    expect(res.items[0]!.name).toBe('Sara Hamdy');
  });

  it('counts registrations, the mobile share, verification and guests', async () => {
    const guest = io(`${url}${MARKET_NAMESPACE}`, {
      transports: ['websocket'],
      forceNew: true,
      auth: { deviceId: randomUUID() },
    });
    await new Promise<void>((resolve) => guest.once('connect', () => resolve()));
    await new Promise((resolve) => setTimeout(resolve, 50));
    guest.disconnect();

    const kpis = CustomerKpisSchema.parse(
      (await asAdmin('get', '/admin/customers/kpis').expect(200)).body,
    );
    const stats = await asAdmin('get', '/admin/stats').expect(200);

    expect(kpis.registered).toBeGreaterThanOrEqual(2);
    expect(kpis.signedUpToday).toBeGreaterThanOrEqual(2);
    expect(kpis.signedUpTodayMobileBps).toBe(10_000);
    expect(kpis.guests24h).toBeGreaterThanOrEqual(1);
    expect(kpis.verifiedBps).toBeGreaterThan(0);
    expect(stats.body).toMatchObject({
      registeredCustomers: kpis.registered,
      signedUpToday: kpis.signedUpToday,
      guestVisitors24h: kpis.guests24h,
      guestConversionBps: kpis.conversionBps,
    });
  });
});

describe("a guest's device account", () => {
  it('is never a customer, nor counted in the KPIs, the export or the dashboard', async () => {
    const counts = async () => {
      const [kpis, list, csv, stats, impact] = await Promise.all([
        asAdmin('get', '/admin/customers/kpis').expect(200),
        asAdmin('get', '/admin/customers').expect(200),
        asAdmin('get', '/admin/customers/export.csv').expect(200),
        asAdmin('get', '/admin/stats').expect(200),
        asAdmin('get', '/admin/halts/impact?symbol=DIS').expect(200),
      ]);
      const { registered, active24h } = CustomerKpisSchema.parse(kpis.body);
      return {
        registered,
        active24h,
        total: CustomersResponseSchema.parse(list.body).total,
        csvRows: csv.text.trim().split('\n').length,
        watchlistItems: AdminStatsSchema.parse(stats.body).watchlistItems,
        watchers: HaltImpactSchema.parse(impact.body).holdersAndWatchers,
      };
    };
    const before = await counts();

    const deviceId = randomUUID();
    await http.put(api('/watchlist/DIS')).set(DEVICE_ID_HEADER, deviceId).expect(204);
    const { handle } = await prisma.account.findUniqueOrThrow({ where: { deviceId } });

    expect(await counts()).toEqual(before);
    const found = await asAdmin('get', `/admin/customers?q=${handle}`).expect(200);
    expect(CustomersResponseSchema.parse(found.body).items).toEqual([]);
    await asAdmin('get', `/admin/customers/${handle}`).expect(404);
  });
});

describe('a customer in detail', () => {
  it('shows the books, sessions with masked IPs, and reveals full IPs only to an audited ADMIN', async () => {
    const customer = await signUp(http, { ip: '41.32.7.9' });
    await restingBuy(customer);

    const detail = CustomerDetailSchema.parse(
      (await asAdmin('get', `/admin/customers/${customer.handle}`).expect(200)).body,
    );
    const sessions = CustomerSessionsResponseSchema.parse(
      (
        await asAdmin('get', `/admin/customers/${customer.handle}/sessions`, viewerCookie).expect(
          200,
        )
      ).body,
    );
    await asAdmin('post', `/admin/customers/${customer.handle}/reveal`, viewerCookie).expect(403);
    const revealed = CustomerRevealResponseSchema.parse(
      (await asAdmin('post', `/admin/customers/${customer.handle}/reveal`).expect(200)).body,
    );
    const orders = OrdersResponseSchema.parse(
      (await asAdmin('get', `/admin/customers/${customer.handle}/orders`).expect(200)).body,
    );

    expect(detail).toMatchObject({
      activeSessions: 1,
      lastActiveDevice: 'Mini Trading for iOS',
      suspension: null,
      portfolio: { cashCents: 10_000_000 },
    });
    expect(detail.portfolio.reservedCents).toBeGreaterThan(0);
    expect(sessions.items[0]!.ipMasked).toBe('41.32.•.•');
    expect(revealed.items).toEqual([{ sessionId: sessions.items[0]!.id, ip: '41.32.7.9' }]);
    expect(orders.items).toHaveLength(1);
    expect(orders.nextCursor).toBeNull();
    expect(
      await prisma.auditLog.count({
        where: { action: 'customer.pii_viewed', entity: `Customer · ${customer.handle}` },
      }),
    ).toBe(1);
    await asAdmin('get', '/admin/customers/ACC-000000').expect(404);
    await asAdmin('get', '/admin/customers/not-a-handle').expect(400);
  });
});

describe('suspending a customer', () => {
  it('signs them out everywhere, cancels working orders and tells them why', async () => {
    const customer = await signUp(http, { ip: nextIp() });
    const order = await restingBuy(customer);
    const socket: Socket = io(`${url}${MARKET_NAMESPACE}`, {
      transports: ['websocket'],
      forceNew: true,
      auth: { deviceId: customer.id, token: customer.token },
    });
    await new Promise<void>((resolve) => socket.once('connect', () => resolve()));
    const revoked = new Promise((resolve) => socket.once('session.revoked', resolve));
    const path = `/admin/customers/${customer.handle}/suspend`;

    await asAdmin('post', path, viewerCookie).send({ reasonCategory: 'abuse', reason }).expect(403);
    const short = await asAdmin('post', path)
      .send({ reasonCategory: 'abuse', reason: 'bots' })
      .expect(400);
    const res = await asAdmin('post', path).send({ reasonCategory: 'abuse', reason }).expect(200);
    await asAdmin('post', path).send({ reasonCategory: 'abuse', reason }).expect(409);

    expect(short.body.errors.reason).toEqual(['REASON_LENGTH']);
    expect(res.body).toMatchObject({
      customer: { status: 'suspended' },
      sessionsRevoked: 1,
      ordersCanceled: 1,
    });
    expect(SessionRevokedEventSchema.parse(await revoked)).toMatchObject({
      reason: 'suspended',
      suspension: { reasonCategory: 'abuse', reason, accountHandle: customer.handle },
    });
    socket.disconnect();
    const canceled = await prisma.order.findUniqueOrThrow({
      where: { id: order.body.order.id as string },
    });
    expect(canceled).toMatchObject({ status: 'canceled', cancelReason: 'account_suspended' });
    await http.get(api('/account')).set('Authorization', bearer(customer)).expect(401);
    const signIn = await http
      .post(api('/auth/sign-in'))
      .set('X-Forwarded-For', nextIp())
      .send({ email: customer.email, password: PASSWORD })
      .expect(403);
    expect(signIn.body.code).toBe('ACCOUNT_SUSPENDED');

    const detail = CustomerDetailSchema.parse(
      (await asAdmin('get', `/admin/customers/${customer.handle}`, viewerCookie).expect(200)).body,
    );
    expect(detail.suspension).toMatchObject({
      reasonCategory: 'abuse',
      reason,
      by: 'a•••@sarwa.dev',
    });

    await asAdmin('post', `/admin/customers/${customer.handle}/reactivate`)
      .send({ reason })
      .expect(200);
    await http
      .post(api('/auth/sign-in'))
      .set('X-Forwarded-For', nextIp())
      .send({ email: customer.email, password: PASSWORD })
      .expect(200);
  });
});

describe('other admin actions', () => {
  it('signs out every device, sends a reset link and resets the paper account', async () => {
    const customer = await signUp(http, { ip: nextIp() });
    const base = `/admin/customers/${customer.handle}`;

    const signedOut = await asAdmin('post', `${base}/sign-out-all`).send({ reason }).expect(200);
    await asAdmin('post', `${base}/password-reset`).send({ reason }).expect(200);
    await asAdmin('post', `${base}/reset-account`).send({ reason, confirm: 'RESET' }).expect(422);
    await asAdmin('post', `${base}/reset-account`)
      .send({ reason, confirm: resetConfirmation(customer.handle) })
      .expect(200);

    expect(signedOut.body.sessionsRevoked).toBe(1);
    expect(mailer.tokenFor(customer.email, 'password_reset')).toBeTruthy();
    await http.get(api('/account')).set('Authorization', bearer(customer)).expect(401);
    const audit = await prisma.auditLog.findMany({
      where: { entity: { in: [`Customer · ${customer.handle}`, `Account · ${customer.handle}`] } },
      orderBy: { createdAt: 'asc' },
    });
    expect(audit.map((a) => a.action)).toEqual([
      'customer.signup',
      'customer.signout_all',
      'customer.reset_password_sent',
      'account.reset',
    ]);
    expect(JSON.parse(audit[3]!.payload)).toMatchObject({ reason });
  });

  it('shows the activity, merging the audit trail with trading events', async () => {
    const customer = await signUp(http, { ip: nextIp() });
    await restingBuy(customer);
    await asAdmin('post', `/admin/customers/${customer.handle}/sign-out-all`)
      .send({ reason })
      .expect(200);

    const viewer = CustomerActivityResponseSchema.parse(
      (
        await asAdmin('get', `/admin/customers/${customer.handle}/activity`, viewerCookie).expect(
          200,
        )
      ).body,
    );
    const firstPage = CustomerActivityResponseSchema.parse(
      (await asAdmin('get', `/admin/customers/${customer.handle}/activity?limit=1`).expect(200))
        .body,
    );

    expect(viewer.items.map((i) => i.action).sort()).toEqual(
      ['customer.signout_all', 'customer.signup', 'order.placed'].sort(),
    );
    expect(viewer.items.find((i) => i.action === 'customer.signout_all')?.actor).toEqual({
      kind: 'admin',
      email: 'a•••@sarwa.dev',
    });
    expect(viewer.items.find((i) => i.action === 'customer.signup')?.actor.kind).toBe('customer');
    expect(firstPage.items).toHaveLength(1);
    expect(firstPage.nextCursor).not.toBeNull();
  });

  it('exports CSV for ADMIN only, defusing formulas, and audits it', async () => {
    const customer = await signUp(http, { ip: nextIp(), name: '=HYPERLINK("x")' });
    const exports = () => prisma.auditLog.count({ where: { action: 'customer.export' } });
    const before = await exports();

    await asAdmin('get', '/admin/customers/export.csv', viewerCookie).expect(403);
    const res = await asAdmin('get', `/admin/customers/export.csv?q=${customer.handle}`).expect(
      200,
    );

    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toContain('customers.csv');
    expect(res.text.split('\r\n')[0]).toBe(
      'handle,name,email,status,emailVerified,signupPlatform,equityCents,allTimeCents,openOrders,lastActiveAt,createdAt',
    );
    expect(res.text).toContain(`${customer.handle},"'=HYPERLINK(""x"")",${customer.email},active`);
    expect(await exports()).toBe(before + 1);
  });
});
