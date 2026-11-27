import { type INestApplication } from '@nestjs/common';
import request from 'supertest';

import { type Halt } from '@sarwa/contracts';
import { DEFAULT_CIRCUIT_BREAKER } from '@sarwa/domain';

import { MarketService } from '../src/market/market.service';
import { TradingEngine } from '../src/trading/engine.service';
import { FakeClock, startApp } from './app';

const T0 = Date.UTC(2026, 11, 1, 15, 0);

const clock = new FakeClock(T0);
let app: INestApplication;
let http: ReturnType<typeof request>;
let market: MarketService;
let engine: TradingEngine;
let adminCookie: string;

const api = (path: string) => `/api/v1${path}`;
const admin = (method: 'get' | 'post' | 'patch', path: string) =>
  http[method](api(path)).set('Cookie', adminCookie).set('X-Forwarded-For', '127.0.0.1');

async function moveTo(symbol: string, price: number): Promise<void> {
  market.movePrice(symbol, price);
  await engine.idle();
}

async function halts(): Promise<Halt[]> {
  return ((await admin('get', '/admin/trading').expect(200)).body as { halts: Halt[] }).halts;
}

beforeAll(async () => {
  ({ app } = await startApp({ clock }));
  http = request(app.getHttpServer());
  market = app.get(MarketService);
  engine = app.get(TradingEngine);
  market.random = () => 0.99;
  const res = await http
    .post(api('/admin/auth/login'))
    .set('X-Forwarded-For', '198.20.0.1')
    .send({ email: 'admin@sarwa.dev', password: 'admin12345', remember: false })
    .expect(200);
  adminCookie = ([] as string[]).concat(res.headers['set-cookie'] ?? [])[0]!.split(';')[0]!;
  await admin('patch', '/admin/trading')
    .send({ sessionMode: 'always-open', circuitBreaker: { enabled: true } })
    .expect(200);
});

afterAll(async () => {
  await admin('patch', '/admin/trading')
    .send({ circuitBreaker: { ...DEFAULT_CIRCUIT_BREAKER, enabled: false } })
    .expect(200);
  await app.close();
});

describe('circuit breaker around halts', () => {
  afterEach(async () => {
    for (const halt of await halts()) await admin('post', `/admin/halts/${halt.symbol}/resume`);
  });

  it('does not auto-halt on resume after an admin halt that the price moved 15% through', async () => {
    await moveTo('JPM', 200);
    clock.advance(2_000);
    await admin('post', '/admin/halts')
      .send({ symbol: 'JPM', message: 'News pending', duration: '15m', notify: false })
      .expect(201);
    await moveTo('JPM', 230);
    clock.advance(2_000);
    await admin('post', '/admin/halts/JPM/resume').expect(204);

    await moveTo('JPM', 230);

    expect(await halts()).toEqual([]);
  });

  it('does not re-halt on the next normal tick after a breaker halt resumes', async () => {
    // Shorter than the window, so pre-halt samples would still be in it on resume.
    const haltMs = 60_000;
    await admin('patch', '/admin/trading').send({ circuitBreaker: { haltMs } }).expect(200);
    await moveTo('V', 300);
    clock.advance(2_000);
    await moveTo('V', 335);
    const tripped = await halts();
    clock.advance(haltMs);
    await admin('post', '/admin/halts/V/resume').expect(204);

    clock.advance(2_000);
    await moveTo('V', 336);

    expect(tripped).toEqual([expect.objectContaining({ symbol: 'V', source: 'circuit_breaker' })]);
    expect(await halts()).toEqual([]);
  });
});
