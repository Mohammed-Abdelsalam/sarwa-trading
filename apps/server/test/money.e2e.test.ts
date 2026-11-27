import { randomUUID } from 'node:crypto';

import { type INestApplication } from '@nestjs/common';
import request from 'supertest';

import {
  DEVICE_ID_HEADER,
  type Order,
  PlaceOrderResponseSchema,
  PortfolioResponseSchema,
} from '@sarwa/contracts';
import {
  bps,
  dollarsToTicks,
  micros,
  MICROS_PER_SHARE,
  notionalCents,
  POLICY,
  scaleBps,
  sharesForCents,
  spreadAround,
  type Ticks,
} from '@sarwa/domain';

import { MarketService } from '../src/market/market.service';
import { TradingEngine } from '../src/trading/engine.service';
import { ExecutionService } from '../src/trading/execution.service';
import { FakeClock, pinned, startApp } from './app';

// Tuesday 1 Dec 2026, 10:00 in New York; Saturday; and the next Monday at 10:00.
const T0 = Date.UTC(2026, 11, 1, 15, 0);
const SATURDAY = Date.UTC(2026, 11, 5, 15, 0);
const MONDAY = Date.UTC(2026, 11, 7, 15, 0);
const SPREAD_BPS = bps(2);

const clock = new FakeClock(T0);
let app: INestApplication;
let http: ReturnType<typeof request>;
let market: MarketService;
let engine: TradingEngine;
let execution: ExecutionService;
let adminCookie: string;
let ipCounter = 10;

const api = (path: string) => `/api/v1${path}`;
const nextIp = () => `198.19.0.${String(ipCounter++)}`;

interface Device {
  id: string;
  ip: string;
}

const newDevice = (): Device => ({ id: randomUUID(), ip: nextIp() });

const admin = (method: 'post' | 'patch', path: string) =>
  http[method](api(path)).set('Cookie', adminCookie).set('X-Forwarded-For', '127.0.0.1');

async function placed(device: Device, body: object): Promise<Order> {
  const res = await http
    .post(api('/orders'))
    .set(DEVICE_ID_HEADER, device.id)
    .set('X-Forwarded-For', device.ip)
    .set('Idempotency-Key', randomUUID().replaceAll('-', ''))
    .send(body)
    .expect(201);
  return PlaceOrderResponseSchema.parse(res.body).order;
}

async function order(device: Device, id: string): Promise<Order> {
  const res = await http
    .get(api(`/orders/${id}`))
    .set(DEVICE_ID_HEADER, device.id)
    .set('X-Forwarded-For', device.ip)
    .expect(200);
  return (res.body as { order: Order }).order;
}

async function books(device: Device) {
  const res = await http
    .get(api('/portfolio'))
    .set(DEVICE_ID_HEADER, device.id)
    .set('X-Forwarded-For', device.ip)
    .expect(200);
  const parsed = PortfolioResponseSchema.parse(res.body);
  const held = parsed.holds.reduce((sum, hold) => sum + hold.heldCents, 0);
  return { cash: parsed.account.cashCents, buyingPower: parsed.account.cashCents - held };
}

async function moveTo(symbol: string, price: number): Promise<void> {
  market.movePrice(symbol, price);
  await engine.idle();
}

// The most whole shares the starting cash can hold at this price.
const allIn = (holdPriceTicks: Ticks) =>
  micros(
    Math.floor(sharesForCents(POLICY.startingCashCents, holdPriceTicks) / MICROS_PER_SHARE) *
      MICROS_PER_SHARE,
  );

const shareBuy = (symbol: string, type: 'market' | 'stop', micros: number, quoted: number) => ({
  symbol,
  side: 'buy',
  type,
  tif: 'day',
  size: { kind: 'shares', micros },
  quotedTicks: dollarsToTicks(quoted),
});

beforeAll(async () => {
  ({ app } = await startApp({ clock, ...pinned }));
  http = request(app.getHttpServer());
  market = app.get(MarketService);
  engine = app.get(TradingEngine);
  execution = app.get(ExecutionService);
  const res = await http
    .post(api('/admin/auth/login'))
    .set('X-Forwarded-For', nextIp())
    .send({ email: 'admin@sarwa.dev', password: 'admin12345', remember: false })
    .expect(200);
  adminCookie = ([] as string[]).concat(res.headers['set-cookie'] ?? [])[0]!.split(';')[0]!;
  await admin('patch', '/admin/trading')
    .send({ sessionMode: 'always-open', circuitBreaker: { enabled: false } })
    .expect(200);
});

afterAll(async () => {
  await app.close();
});

afterEach(async () => {
  clock.set(T0);
  await admin('patch', '/admin/trading').send({ sessionMode: 'always-open' }).expect(200);
});

describe('a buy that gaps past its hold', () => {
  it('rejects a buy stop with INSUFFICIENT_FUNDS when the price gaps 15% past the stop', async () => {
    const device = newDevice();
    await moveTo('XOM', 100);
    const qty = allIn(scaleBps(dollarsToTicks(105), bps(500), 'up'));
    const stop = await placed(device, {
      ...shareBuy('XOM', 'stop', qty, 100),
      stopTicks: dollarsToTicks(105),
    });

    await moveTo('XOM', 121);
    const after = await order(device, stop.id);
    const { cash, buyingPower } = await books(device);

    expect(stop.status).toBe('open');
    expect(after).toMatchObject({
      status: 'rejected',
      heldCents: 0,
      filledMicros: 0,
      rejection: { code: 'INSUFFICIENT_FUNDS' },
    });
    expect(cash).toBe(POLICY.startingCashCents);
    expect(cash).toBeGreaterThanOrEqual(0);
    expect(buyingPower).toBeGreaterThanOrEqual(0);
  });

  it('rejects a market buy filled on a later tick after the ask moved past the slippage cap', async () => {
    const device = newDevice();
    await moveTo('UNH', 500);
    const { askTicks } = spreadAround(dollarsToTicks(500), SPREAD_BPS);
    const qty = allIn(scaleBps(askTicks, bps(5), 'up'));
    // The fill at placement is lost (as after a crash), so the order fills on the next tick.
    jest.spyOn(execution, 'work').mockResolvedValueOnce(micros(0));
    const buy = await placed(device, shareBuy('UNH', 'market', qty, 500));

    await moveTo('UNH', 505);
    const after = await order(device, buy.id);
    const { cash, buyingPower } = await books(device);

    expect(buy).toMatchObject({
      status: 'open',
      heldCents: notionalCents(qty, scaleBps(askTicks, bps(5), 'up'), 'up'),
    });
    expect(after).toMatchObject({
      status: 'rejected',
      heldCents: 0,
      rejection: { code: 'INSUFFICIENT_FUNDS' },
    });
    expect(cash).toBe(POLICY.startingCashCents);
    expect(buyingPower).toBeGreaterThanOrEqual(0);
  });

  it('rejects a queued market buy whose open gaps past the closed-market buffer', async () => {
    const device = newDevice();
    await moveTo('AMD', 150);
    await admin('patch', '/admin/trading').send({ sessionMode: 'calendar' }).expect(200);
    clock.set(SATURDAY);
    const { askTicks } = spreadAround(dollarsToTicks(150), SPREAD_BPS);
    const qty = allIn(scaleBps(askTicks, bps(500), 'up'));
    const queued = await placed(device, shareBuy('AMD', 'market', qty, 150));

    clock.set(MONDAY);
    await moveTo('AMD', 162);
    const after = await order(device, queued.id);
    const { cash, buyingPower } = await books(device);

    expect(queued.rejection ?? null).toBeNull();
    expect(queued.status).toBe('queued');
    expect(after).toMatchObject({
      status: 'rejected',
      heldCents: 0,
      rejection: { code: 'INSUFFICIENT_FUNDS' },
    });
    expect(cash).toBe(POLICY.startingCashCents);
    expect(buyingPower).toBeGreaterThanOrEqual(0);
  });

  it('still fills a gapped stop that the free cash covers', async () => {
    const device = newDevice();
    await moveTo('XOM', 100);
    const stop = await placed(device, {
      ...shareBuy('XOM', 'stop', 10 * MICROS_PER_SHARE, 100),
      stopTicks: dollarsToTicks(105),
    });

    await moveTo('XOM', 121);
    const after = await order(device, stop.id);
    const { cash, buyingPower } = await books(device);

    expect(after.status).toBe('filled');
    expect(cash).toBe(POLICY.startingCashCents - after.filledNotionalCents);
    expect(buyingPower).toBe(cash);
  });
});
