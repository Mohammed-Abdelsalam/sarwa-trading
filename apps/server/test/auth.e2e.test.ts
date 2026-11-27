import { randomUUID } from 'node:crypto';

import { type INestApplication } from '@nestjs/common';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';

import {
  AccountSuspendedProblemSchema,
  AuthSessionResponseSchema,
  CLIENT_PLATFORM_HEADER,
  CSRF_COOKIE,
  CSRF_HEADER,
  CUSTOMER_ACCESS_COOKIE,
  CUSTOMER_REFRESH_COOKIE,
  DEVICE_ID_HEADER,
  GuestDataPresentProblemSchema,
  MARKET_NAMESPACE,
  NotificationsResponseSchema,
  RateLimitedProblemSchema,
  SessionRevokedEventSchema,
  TokenExpiredProblemSchema,
} from '@sarwa/contracts';
import { POLICY } from '@sarwa/domain';

import { RetentionService } from '../src/auth/retention.service';
import { PrismaService } from '../src/prisma.service';
import { CapturingMailer, FakeClock, pinned, startApp } from './app';
import { bearer, type Customer, PASSWORD, signUp, uniqueEmail } from './customers';

const clock = new FakeClock(Date.now());
const mailer = new CapturingMailer();
let app: INestApplication;
let url: string;
let http: ReturnType<typeof request>;
let prisma: PrismaService;
let ipCounter = 1;

const api = (path: string) => `/api/v1${path}`;
const nextIp = () =>
  `203.0.${String(Math.floor(ipCounter / 250))}.${String((ipCounter++ % 250) + 1)}`;

const signIn = (
  body: object,
  {
    ip = nextIp(),
    deviceId,
    platform = 'ios',
  }: { ip?: string; deviceId?: string; platform?: string } = {},
) =>
  http
    .post(api('/auth/sign-in'))
    .set('X-Forwarded-For', ip)
    .set(DEVICE_ID_HEADER, deviceId ?? randomUUID())
    .set(CLIENT_PLATFORM_HEADER, platform)
    .send(body);

const cookiesOf = (res: request.Response): Record<string, string> =>
  Object.fromEntries(
    ([] as string[])
      .concat(res.headers['set-cookie'] ?? [])
      .map((cookie) => cookie.split(';')[0]!.split('=') as [string, string]),
  );

async function connect(auth: object): Promise<Socket> {
  const socket = io(`${url}${MARKET_NAMESPACE}`, {
    transports: ['websocket'],
    forceNew: true,
    auth,
  });
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
  return socket;
}

function waitFor<T>(socket: Socket, event: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`No ${event} event`));
    }, 5_000);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

// A device that browsed and traded as a guest before this change: a paper account with a star,
// and a position when it traded.
async function guestDevice(traded = false): Promise<{ deviceId: string; accountId: string }> {
  const deviceId = randomUUID();
  const account = await prisma.account.create({
    data: {
      handle: `ACC-${randomUUID().slice(0, 6).toUpperCase()}`,
      cashCents: BigInt(POLICY.startingCashCents),
      createdAt: new Date(clock.now()),
      device: { create: { id: deviceId } },
      watchlist: { create: { symbol: 'AAPL' } },
      ...(traded && {
        positions: {
          create: { symbol: 'MSFT', qtyMicros: 1_000_000n, costBasisCents: 40_000n },
        },
      }),
    },
  });
  return { deviceId, accountId: account.id };
}

beforeAll(async () => {
  ({ app, url } = await startApp({ clock, mailer, ...pinned }));
  http = request(app.getHttpServer());
  prisma = app.get(PrismaService);
});

afterAll(async () => {
  await app.close();
});

describe('sign-up', () => {
  it('opens a $100,000 paper account at once, welcomes the customer and asks to verify', async () => {
    const customer = await signUp(http, { ip: nextIp(), platform: 'android' });

    const account = await http
      .get(api('/account'))
      .set('Authorization', bearer(customer))
      .expect(200);
    const inbox = NotificationsResponseSchema.parse(
      (await http.get(api('/notifications')).set('Authorization', bearer(customer))).body,
    );
    const user = await prisma.user.findUniqueOrThrow({ where: { id: customer.userId } });
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'customer.signup', entity: `Customer · ${customer.handle}` },
    });

    expect(account.body).toMatchObject({
      id: customer.accountId,
      cashCents: POLICY.startingCashCents,
    });
    expect(inbox.items.map((n) => n.payload)).toEqual([{ kind: 'welcome' }]);
    expect(mailer.tokenFor(customer.email, 'verify_email')).toBeTruthy();
    expect(user).toMatchObject({ signupPlatform: 'android', emailVerifiedAt: null });
    expect(user.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(JSON.parse(audit.payload)).toEqual({ platform: 'android' });
  });

  it("keeps the device's guest portfolio in the new account", async () => {
    const guest = await guestDevice();

    const customer = await signUp(http, { ip: nextIp(), deviceId: guest.deviceId });
    const res = await signIn(
      { email: customer.email, password: PASSWORD },
      { deviceId: guest.deviceId },
    );
    const account = await prisma.account.findUniqueOrThrow({ where: { id: guest.accountId } });

    expect(customer.accountId).toBe(guest.accountId);
    expect(account).toMatchObject({ userId: customer.userId, deviceId: null });
    expect(res.status).toBe(200);
  });

  it('moves the stars a guest made on this device into the new account', async () => {
    const deviceId = randomUUID();
    for (const symbol of ['AAPL', 'NVDA']) {
      await http
        .put(api(`/watchlist/${symbol}`))
        .set(DEVICE_ID_HEADER, deviceId)
        .expect(204);
    }

    const customer = await signUp(http, { ip: nextIp(), deviceId });
    const list = await http
      .get(api('/watchlist'))
      .set('Authorization', bearer(customer))
      .expect(200);
    const guestList = await http.get(api('/watchlist')).set(DEVICE_ID_HEADER, deviceId).expect(200);

    expect(list.body).toEqual({ symbols: ['AAPL', 'NVDA'] });
    expect(guestList.body).toEqual({ symbols: [] });
  });

  it('reports what it claimed', async () => {
    const guest = await guestDevice();

    const res = await http
      .post(api('/auth/sign-up'))
      .set(DEVICE_ID_HEADER, guest.deviceId)
      .set(CLIENT_PLATFORM_HEADER, 'ios')
      .set('X-Forwarded-For', nextIp())
      .send({ name: 'Sara', email: uniqueEmail(), password: PASSWORD, terms: true })
      .expect(201);

    expect(AuthSessionResponseSchema.parse(res.body).claimed).toEqual({
      positions: 0,
      openOrders: 0,
      watchlist: 1,
    });
  });

  it('refuses a taken email, a common password and missing terms', async () => {
    const customer = await signUp(http, { ip: nextIp() });
    const send = (body: object) =>
      http.post(api('/auth/sign-up')).set('X-Forwarded-For', nextIp()).send(body);

    const taken = await send({
      name: 'Again',
      email: customer.email.toUpperCase(),
      password: PASSWORD,
      terms: true,
    }).expect(409);
    const weak = await send({
      name: 'Weak',
      email: uniqueEmail(),
      password: 'password',
      terms: true,
    });
    const noTerms = await send({ name: 'No', email: uniqueEmail(), password: PASSWORD });

    expect(taken.body.code).toBe('EMAIL_IN_USE');
    expect(weak.status).toBe(400);
    expect(weak.body.errors.password).toContain('PASSWORD_COMMON');
    expect(noTerms.body.errors.terms).toEqual(['TERMS_REQUIRED']);
  });

  it('allows 10 sign-ups an hour from one IP', async () => {
    const ip = nextIp();
    for (let i = 0; i < 10; i++) await signUp(http, { ip });

    const res = await http
      .post(api('/auth/sign-up'))
      .set('X-Forwarded-For', ip)
      .send({ name: 'Eleventh', email: uniqueEmail(), password: PASSWORD, terms: true })
      .expect(429);

    const problem = RateLimitedProblemSchema.parse(res.body);
    expect(res.headers['retry-after']).toBe(String(problem.retryAfterSeconds));
    expect(problem.retryAfterSeconds).toBeGreaterThan(3_500);
  });
});

describe('sign-in', () => {
  let customer: Customer;

  beforeAll(async () => {
    customer = await signUp(http, { ip: nextIp() });
  });

  it('signs in with the right password and answers the same for any wrong one', async () => {
    const ok = await signIn({ email: customer.email, password: PASSWORD }).expect(200);
    const wrong = await signIn({ email: customer.email, password: 'wrong-pass-1' }).expect(401);
    const unknown = await signIn({ email: uniqueEmail(), password: PASSWORD }).expect(401);

    expect(AuthSessionResponseSchema.parse(ok.body).user.email).toBe(customer.email);
    expect(wrong.body).toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(unknown.body).toEqual(wrong.body);
  });

  it('signs in the seeded demo customers to their demo books', async () => {
    const res = await signIn({ email: 'demo1@sarwa.dev', password: 'practice-1234' }).expect(200);
    const session = AuthSessionResponseSchema.parse(res.body);
    const books = await http
      .get(api('/portfolio'))
      .set('Authorization', bearer({ token: session.accessToken! }))
      .expect(200);

    expect(session.user).toMatchObject({ name: 'Sara Hamdy', emailVerified: true });
    expect(session.user.account.handle).toBe('ACC-5EED01');
    expect(books.body.positions.length).toBeGreaterThan(0);
  });

  it('pauses an account for 15 minutes after 5 failures, from any IP', async () => {
    const target = await signUp(http, { ip: nextIp() });
    for (let i = 0; i < 5; i++) {
      await signIn({ email: target.email, password: 'wrong-pass-1' }).expect(401);
    }

    const locked = await signIn({ email: target.email, password: PASSWORD }).expect(429);
    clock.advance(15 * 60_000 + 1);
    await signIn({ email: target.email, password: PASSWORD }).expect(200);

    expect(RateLimitedProblemSchema.parse(locked.body).retryAfterSeconds).toBe(900);
    expect(locked.headers['retry-after']).toBe('900');
  });

  it('stops one IP after 5 failures across accounts', async () => {
    const ip = nextIp();
    for (let i = 0; i < 5; i++) {
      await signIn({ email: uniqueEmail(), password: 'wrong-pass-1' }, { ip }).expect(401);
    }

    const res = await signIn({ email: customer.email, password: PASSWORD }, { ip }).expect(429);

    expect(res.body.code).toBe('RATE_LIMITED');
  });

  it('tells a suspended customer why, only after the right password', async () => {
    const target = await signUp(http, { ip: nextIp() });
    await prisma.user.update({
      where: { id: target.userId },
      data: {
        status: 'suspended',
        suspensionCategory: 'abuse',
        suspensionReason: 'Automated trading scripts',
        suspendedAt: new Date(clock.now()),
      },
    });

    await signIn({ email: target.email, password: 'wrong-pass-1' }).expect(401);
    const res = await signIn({ email: target.email, password: PASSWORD }).expect(403);

    expect(AccountSuspendedProblemSchema.parse(res.body).suspension).toEqual({
      reasonCategory: 'abuse',
      reason: 'Automated trading scripts',
      at: clock.now(),
      accountHandle: target.handle,
    });
  });

  it("merges a guest's stars into the account without duplicates", async () => {
    const deviceId = randomUUID();
    for (const symbol of ['AAPL', 'NVDA']) {
      await http
        .put(api(`/watchlist/${symbol}`))
        .set(DEVICE_ID_HEADER, deviceId)
        .expect(204);
    }
    const user = await signUp(http, { ip: nextIp() });
    for (const symbol of ['MSFT', 'AAPL']) {
      await http
        .put(api(`/watchlist/${symbol}`))
        .set('Authorization', bearer(user))
        .expect(204);
    }

    await signIn({ email: user.email, password: PASSWORD }, { deviceId }).expect(200);
    const list = await http.get(api('/watchlist')).set('Authorization', bearer(user)).expect(200);

    expect(list.body).toEqual({ symbols: ['MSFT', 'AAPL', 'NVDA'] });
    expect(await prisma.account.findUnique({ where: { deviceId } })).toBeNull();
  });

  it("warns before replacing a device's guest data, then drops it when confirmed", async () => {
    const guest = await guestDevice(true);
    const credentials = { email: customer.email, password: PASSWORD };

    const warned = await signIn(credentials, { deviceId: guest.deviceId }).expect(409);
    const problem = GuestDataPresentProblemSchema.parse(warned.body);
    await signIn({ ...credentials, guestTicket: 'forged' }, { deviceId: guest.deviceId }).expect(
      409,
    );
    const other = await signIn(credentials, { deviceId: randomUUID() }).expect(200);
    const confirmed = await signIn(
      { ...credentials, guestTicket: problem.ticket },
      { deviceId: guest.deviceId },
    ).expect(200);

    expect(problem).toMatchObject({ positions: 1, openOrders: 0, watchlist: 1 });
    expect(AuthSessionResponseSchema.parse(confirmed.body).user.account.id).toBe(
      customer.accountId,
    );
    expect(other.body.user.account.id).toBe(customer.accountId);
    expect(await prisma.account.findUnique({ where: { id: guest.accountId } })).toBeNull();
  });
});

describe('personal routes', () => {
  it('turn guests away and keep each customer to their own account', async () => {
    const [owner, other] = [
      await signUp(http, { ip: nextIp() }),
      await signUp(http, { ip: nextIp() }),
    ];
    const order = await http
      .post(api('/orders'))
      .set('Authorization', bearer(owner))
      .set('Idempotency-Key', randomUUID().replaceAll('-', ''))
      .send({
        symbol: 'AAPL',
        side: 'buy',
        type: 'limit',
        tif: 'gtc',
        size: { kind: 'shares', micros: 1_000_000 },
        limitTicks: 1_000_000,
        quotedTicks: 2_000_000,
      })
      .expect(201);

    for (const path of ['/account', '/portfolio', '/orders', '/alerts', '/notifications']) {
      const res = await http.get(api(path)).set(DEVICE_ID_HEADER, owner.id).expect(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    }
    await http
      .get(api(`/orders/${String(order.body.order.id)}`))
      .set('Authorization', bearer(other))
      .expect(404);
    await http.get(api('/account')).set('Authorization', 'Bearer not-a-token').expect(401);
    await http.get(api('/stocks')).expect(200);
    await http.get(api('/trading/status')).expect(200);
  });
});

describe('refresh', () => {
  it('rotates the refresh token and ends the session when an old one comes back', async () => {
    const customer = await signUp(http, { ip: nextIp() });
    const refresh = (refreshToken: string) =>
      http.post(api('/auth/refresh')).set('X-Forwarded-For', customer.ip).send({ refreshToken });

    const first = AuthSessionResponseSchema.parse(
      (await refresh(customer.refreshToken).expect(200)).body,
    );
    // Two tabs racing with the same token: the second still gets a session.
    const raced = AuthSessionResponseSchema.parse(
      (await refresh(customer.refreshToken).expect(200)).body,
    );
    clock.advance(11_000);
    const reused = await refresh(customer.refreshToken).expect(401);

    expect(first.refreshToken).not.toBe(customer.refreshToken);
    expect(reused.body.code).toBe('SESSION_REVOKED');
    await refresh(raced.refreshToken!).expect(401);
    await http
      .get(api('/account'))
      .set('Authorization', bearer({ token: raced.accessToken! }))
      .expect(401);
  });
});

describe('the web session', () => {
  async function webSignIn() {
    const customer = await signUp(http, { ip: nextIp() });
    const res = await http
      .post(api('/auth/sign-in'))
      .set('X-Forwarded-For', nextIp())
      .set(
        'User-Agent',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
      )
      .send({ email: customer.email, password: PASSWORD })
      .expect(200);
    return { customer, res, cookies: cookiesOf(res) };
  }

  it('keeps tokens in httpOnly cookies and never in the body', async () => {
    const { res, cookies } = await webSignIn();
    const raw = ([] as string[]).concat(res.headers['set-cookie'] ?? []);

    expect(res.body.accessToken).toBeUndefined();
    expect(res.body.refreshToken).toBeUndefined();
    expect(raw.find((c) => c.startsWith(CUSTOMER_ACCESS_COOKIE))).toMatch(/HttpOnly.*SameSite=Lax/);
    expect(raw.find((c) => c.startsWith(CUSTOMER_REFRESH_COOKIE))).toMatch(
      /Path=\/api\/v1\/auth.*HttpOnly/,
    );
    expect(raw.find((c) => c.startsWith(CSRF_COOKIE))).not.toMatch(/HttpOnly/);
    expect(cookies[CUSTOMER_ACCESS_COOKIE]).toBeTruthy();
  });

  it('needs the CSRF header on writes made with the cookie, from our own origin', async () => {
    const { cookies } = await webSignIn();
    const jar = Object.entries(cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
    const put = () => http.put(api('/watchlist/AAPL')).set('Cookie', jar);

    await http.get(api('/watchlist')).set('Cookie', jar).expect(200);
    const missing = await put().expect(403);
    await put().set(CSRF_HEADER, 'guess').expect(403);
    await put()
      .set(CSRF_HEADER, cookies[CSRF_COOKIE]!)
      .set('Origin', 'https://evil.example')
      .expect(403);
    await put().set(CSRF_HEADER, cookies[CSRF_COOKIE]!).expect(204);

    expect(missing.body.code).toBe('CSRF_FAILED');
  });

  it('refreshes from the cookie and names the session after the browser', async () => {
    const { customer, cookies } = await webSignIn();
    const jar = Object.entries(cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');

    await http.post(api('/auth/refresh')).set('Cookie', jar).expect(403);
    const res = await http
      .post(api('/auth/refresh'))
      .set('Cookie', jar)
      .set(CSRF_HEADER, cookies[CSRF_COOKIE]!)
      .expect(200);
    const sessions = await prisma.session.findMany({
      where: { userId: customer.userId, platform: 'web', rotatedAt: null },
    });

    expect(cookiesOf(res)[CUSTOMER_REFRESH_COOKIE]).not.toBe(cookies[CUSTOMER_REFRESH_COOKIE]);
    expect(sessions.map((s) => s.label)).toEqual(['Chrome on macOS']);
  });
});

describe('sockets', () => {
  it("deliver a customer's events to that customer only, and end with the session", async () => {
    const [owner, other] = [
      await signUp(http, { ip: nextIp() }),
      await signUp(http, { ip: nextIp() }),
    ];
    const mine = await connect({ deviceId: owner.id, token: owner.token });
    const theirs = await connect({ deviceId: other.id, token: other.token });
    const guest = await connect({ deviceId: randomUUID() });
    const leaked: unknown[] = [];
    theirs.on('order.updated', (e: unknown) => leaked.push(e));
    guest.on('order.updated', (e: unknown) => leaked.push(e));
    const updated = waitFor(mine, 'order.updated');

    await http
      .post(api('/orders'))
      .set('Authorization', bearer(owner))
      .set('Idempotency-Key', randomUUID().replaceAll('-', ''))
      .send({
        symbol: 'MSFT',
        side: 'buy',
        type: 'limit',
        tif: 'gtc',
        size: { kind: 'shares', micros: 1_000_000 },
        limitTicks: 1_000_000,
        quotedTicks: 4_000_000,
      })
      .expect(201);
    await updated;
    const revoked = waitFor(mine, 'session.revoked');
    const dropped = waitFor(mine, 'disconnect');
    await http.post(api('/auth/sign-out')).set('Authorization', bearer(owner)).expect(204);

    expect(SessionRevokedEventSchema.parse(await revoked)).toEqual({ v: 1, reason: 'signed_out' });
    await dropped;
    expect(leaked).toEqual([]);
    await http.get(api('/account')).set('Authorization', bearer(owner)).expect(401);
    for (const socket of [theirs, guest]) socket.disconnect();
  });
});

describe('the signed-in customer', () => {
  const as = (
    customer: { token: string },
    method: 'get' | 'post' | 'patch' | 'delete',
    path: string,
  ) => http[method](api(path)).set('Authorization', bearer(customer));

  async function secondDevice(customer: Customer) {
    const res = await signIn(
      { email: customer.email, password: PASSWORD, deviceModel: 'Pixel 9' },
      { platform: 'android' },
    ).expect(200);
    const session = AuthSessionResponseSchema.parse(res.body);
    return { token: session.accessToken!, refreshToken: session.refreshToken! };
  }

  it('reads and renames their profile and sums up what deleting would remove', async () => {
    const customer = await signUp(http, { ip: nextIp(), name: 'Sara' });

    const me = await as(customer, 'get', '/me').expect(200);
    const renamed = await as(customer, 'patch', '/me/profile')
      .send({ name: '  Sara H.  ' })
      .expect(200);
    const summary = await as(customer, 'get', '/me/summary').expect(200);

    expect(me.body.user).toMatchObject({
      email: customer.email,
      name: 'Sara',
      emailVerified: false,
      passwordChangedAt: null,
      account: { id: customer.accountId, handle: customer.handle },
    });
    expect(renamed.body.user.name).toBe('Sara H.');
    expect(summary.body).toEqual({
      equityCents: POLICY.startingCashCents,
      openOrders: 0,
      watchlist: 0,
      alerts: 0,
    });
  });

  it('lists sessions, signs out one or all the others, but not this one', async () => {
    const customer = await signUp(http, { ip: nextIp() });
    const phone = await secondDevice(customer);
    const tablet = await secondDevice(customer);

    const list = await as(customer, 'get', '/auth/sessions').expect(200);
    const items = list.body.items as { id: string; label: string; current: boolean }[];
    const current = items.find((s) => s.current)!;
    const others = items.filter((s) => !s.current);
    await as(customer, 'delete', `/auth/sessions/${current.id}`).expect(400);
    await as(customer, 'delete', '/auth/sessions/not-a-session').expect(404);
    await as(customer, 'delete', `/auth/sessions/${others[0]!.id}`).expect(204);
    const rest = await as(customer, 'post', '/auth/sessions/revoke-others').expect(200);

    expect(items).toHaveLength(3);
    expect(others.map((s) => s.label)).toEqual([
      'Mini Trading for Android · Pixel 9',
      'Mini Trading for Android · Pixel 9',
    ]);
    expect(rest.body).toEqual({ revoked: 1, labels: ['Mini Trading for Android · Pixel 9'] });
    await http.get(api('/account')).set('Authorization', bearer(phone)).expect(401);
    await http.get(api('/account')).set('Authorization', bearer(tablet)).expect(401);
    await as(customer, 'get', '/account').expect(200);
  });

  it('changes the password with the current one and signs out every other device', async () => {
    const customer = await signUp(http, { ip: nextIp() });
    const phone = await secondDevice(customer);
    const socket = await connect({ deviceId: randomUUID(), token: phone.token });
    const revoked = waitFor(socket, 'session.revoked');

    const wrong = await as(customer, 'post', '/me/password')
      .send({ current: 'not-my-password', next: 'brand-new-pass-7' })
      .expect(400);
    const changed = await as(customer, 'post', '/me/password')
      .send({ current: PASSWORD, next: 'brand-new-pass-7' })
      .expect(200);

    expect(wrong.body.code).toBe('INVALID_CURRENT_PASSWORD');
    expect(changed.body).toEqual({ sessionsRevoked: 1 });
    expect(await revoked).toEqual({ v: 1, reason: 'password_changed' });
    expect(mailer.sent.at(-1)).toMatchObject({ to: customer.email, kind: 'password_changed' });
    await http.get(api('/account')).set('Authorization', bearer(phone)).expect(401);
    await as(customer, 'get', '/account').expect(200);
    await signIn({ email: customer.email, password: 'brand-new-pass-7' }).expect(200);
    socket.disconnect();
  });
});

describe('password reset', () => {
  const forgot = (email: string) =>
    http.post(api('/auth/forgot')).set('X-Forwarded-For', nextIp()).send({ email });

  it('answers the same for any email and mails a link only to a real account', async () => {
    const customer = await signUp(http, { ip: nextIp() });
    const before = mailer.sent.length;

    const unknown = await forgot(uniqueEmail()).expect(202);
    const known = await forgot(customer.email).expect(202);

    expect(unknown.body).toEqual(known.body);
    expect(mailer.sent.slice(before)).toEqual([
      expect.objectContaining({ to: customer.email, kind: 'password_reset' }),
    ]);
    expect(
      await prisma.auditLog.count({
        where: { action: 'customer.reset_password_sent', entity: `Customer · ${customer.handle}` },
      }),
    ).toBe(1);
  });

  it('allows 3 requests an hour per email', async () => {
    const email = uniqueEmail();
    for (let i = 0; i < 3; i++) await forgot(email).expect(202);

    const res = await forgot(email).expect(429);

    expect(res.headers['retry-after']).toBeDefined();
  });

  it('sets the new password from the link once, ending every session', async () => {
    const customer = await signUp(http, { ip: nextIp() });
    await forgot(customer.email).expect(202);
    const token = mailer.tokenFor(customer.email, 'password_reset');

    const info = await http.get(api(`/auth/reset/${token}`)).expect(200);
    const reset = await http
      .post(api('/auth/reset'))
      .set(CLIENT_PLATFORM_HEADER, 'ios')
      .send({ token, password: 'fresh-start-99' })
      .expect(200);
    const again = await http
      .post(api('/auth/reset'))
      .send({ token, password: 'fresh-start-99' })
      .expect(410);

    expect(info.body).toEqual({ email: customer.email });
    expect(AuthSessionResponseSchema.parse(reset.body)).toMatchObject({ sessionsRevoked: 1 });
    expect(TokenExpiredProblemSchema.parse(again.body).email).toBe(customer.email);
    await http.get(api('/account')).set('Authorization', bearer(customer)).expect(401);
    await http
      .get(api('/account'))
      .set('Authorization', `Bearer ${String(reset.body.accessToken)}`)
      .expect(200);
    await signIn({ email: customer.email, password: 'fresh-start-99' }).expect(200);
  });

  it('expires the link after 30 minutes', async () => {
    const customer = await signUp(http, { ip: nextIp() });
    await forgot(customer.email).expect(202);
    const token = mailer.tokenFor(customer.email, 'password_reset');

    clock.advance(30 * 60_000 + 1);

    const res = await http.get(api(`/auth/reset/${token}`)).expect(410);
    expect(res.body).toMatchObject({ code: 'TOKEN_EXPIRED', email: customer.email });
    await http.get(api('/auth/reset/not-a-real-token-at-all')).expect(410);
  });
});

describe('email verification', () => {
  it('verifies once from the emailed link', async () => {
    const customer = await signUp(http, { ip: nextIp() });
    const token = mailer.tokenFor(customer.email, 'verify_email');

    const verified = await http.post(api('/auth/verify')).send({ token }).expect(200);
    const reused = await http.post(api('/auth/verify')).send({ token }).expect(410);
    const me = await http.get(api('/me')).set('Authorization', bearer(customer)).expect(200);

    expect(verified.body).toEqual({ email: customer.email });
    expect(reused.body.code).toBe('TOKEN_EXPIRED');
    expect(me.body.user.emailVerified).toBe(true);
  });

  it('resends at most once a minute, for the signed-in customer or a given email', async () => {
    const customer = await signUp(http, { ip: nextIp() });
    const resend = () =>
      http.post(api('/auth/verify/resend')).set('Authorization', bearer(customer)).send({});

    await resend().expect(202);
    const limited = await resend().expect(429);
    clock.advance(60_001);
    await http.post(api('/auth/verify/resend')).send({ email: customer.email }).expect(202);
    await http.post(api('/auth/verify/resend')).send({ email: uniqueEmail() }).expect(202);

    expect(limited.body.retryAfterSeconds).toBe(60);
    expect(
      mailer.sent.filter((m) => m.to === customer.email && m.kind === 'verify_email'),
    ).toHaveLength(3);
  });
});

describe('deleting the account', () => {
  const requestDeletion = (customer: Customer, body: object) =>
    http.post(api('/me/delete')).set('Authorization', bearer(customer)).send(body);

  it('needs the password and DELETE, then signs out everywhere for a 7-day grace', async () => {
    const customer = await signUp(http, { ip: nextIp() });

    const typo = await requestDeletion(customer, { password: PASSWORD, confirm: 'delete' });
    const wrong = await requestDeletion(customer, { password: 'nope-nope-1', confirm: 'DELETE' });
    const accepted = await requestDeletion(customer, { password: PASSWORD, confirm: 'DELETE' });

    expect(typo.status).toBe(400);
    expect(typo.body.errors.confirm).toEqual(['CONFIRMATION_MISMATCH']);
    expect(wrong.body.code).toBe('INVALID_CURRENT_PASSWORD');
    expect(accepted.status).toBe(202);
    expect(accepted.body).toEqual({ purgeAt: clock.now() + 7 * 86_400_000 });
    await http.get(api('/account')).set('Authorization', bearer(customer)).expect(401);
  });

  it('is canceled by signing in during the grace period', async () => {
    const customer = await signUp(http, { ip: nextIp() });
    await requestDeletion(customer, { password: PASSWORD, confirm: 'DELETE' }).expect(202);
    clock.advance(6 * 86_400_000);

    const res = await signIn({ email: customer.email, password: PASSWORD }).expect(200);
    clock.advance(2 * 86_400_000);
    await app.get(RetentionService).purgeDeletedAccounts();

    expect(res.body.deletionCanceled).toBe(true);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: customer.userId } });
    expect(user).toMatchObject({ status: 'active', deletionRequestedAt: null });
  });

  it('anonymizes the profile after 7 days, frees the email and keeps the trading history', async () => {
    const customer = await signUp(http, { ip: nextIp() });
    await http.put(api('/watchlist/AAPL')).set('Authorization', bearer(customer)).expect(204);
    await requestDeletion(customer, { password: PASSWORD, confirm: 'DELETE' }).expect(202);
    clock.advance(7 * 86_400_000 + 1);

    expect(await app.get(RetentionService).purgeDeletedAccounts()).toBe(1);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: customer.userId } });
    const audit = await prisma.auditLog.findFirst({
      where: { action: 'customer.deleted', entity: `Customer · ${customer.handle}` },
    });

    expect(user).toMatchObject({ status: 'deleted', name: 'Deleted customer' });
    expect(user.email).not.toBe(customer.email);
    expect(await prisma.account.findUnique({ where: { id: customer.accountId } })).not.toBeNull();
    expect(await prisma.watchlistItem.count({ where: { accountId: customer.accountId } })).toBe(0);
    expect(await prisma.session.count({ where: { userId: customer.userId } })).toBe(0);
    expect(audit?.actorEmail).toBe('system');
    await signIn({ email: customer.email, password: PASSWORD }).expect(401);
    await signUp(http, { ip: nextIp(), email: customer.email });
  });
});

describe('resetting the paper account', () => {
  it('needs RESET typed in, restores the starting cash and is audited as the customer', async () => {
    const customer = await signUp(http, { ip: nextIp() });
    await prisma.account.update({
      where: { id: customer.accountId },
      data: { cashCents: 123n },
    });
    const reset = (confirm: string) =>
      http.post(api('/me/account/reset')).set('Authorization', bearer(customer)).send({ confirm });

    await reset('reset').expect(400);
    const res = await reset('RESET').expect(200);
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'account.reset', entity: `Account · ${customer.handle}` },
    });

    expect(res.body.account).toMatchObject({ cashCents: POLICY.startingCashCents });
    expect(audit.actorEmail).toBe(customer.email);
    expect(JSON.parse(audit.payload)).toMatchObject({ actor: 'customer' });
  });
});

describe('retention', () => {
  it('drops audit addresses after 90 days and audit events after 400', async () => {
    const day = 86_400_000;
    const old = await prisma.auditLog.create({
      data: {
        actorEmail: 'system',
        action: 'market.pause',
        entity: 'Market',
        payload: '{}',
        ip: '198.51.100.1',
        createdAt: new Date(clock.now() - 91 * day),
      },
    });
    const ancient = await prisma.auditLog.create({
      data: {
        actorEmail: 'system',
        action: 'market.pause',
        entity: 'Market',
        payload: '{}',
        createdAt: new Date(clock.now() - 401 * day),
      },
    });
    const recent = await prisma.auditLog.create({
      data: {
        actorEmail: 'system',
        action: 'market.pause',
        entity: 'Market',
        payload: '{}',
        ip: '198.51.100.2',
        createdAt: new Date(clock.now() - 89 * day),
      },
    });

    await app.get(RetentionService).trimAuditLog();

    expect((await prisma.auditLog.findUniqueOrThrow({ where: { id: old.id } })).ip).toBeNull();
    expect(await prisma.auditLog.findUnique({ where: { id: ancient.id } })).toBeNull();
    expect((await prisma.auditLog.findUniqueOrThrow({ where: { id: recent.id } })).ip).toBe(
      '198.51.100.2',
    );
  });
});
