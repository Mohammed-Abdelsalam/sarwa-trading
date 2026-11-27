import { type INestApplication } from '@nestjs/common';
import request from 'supertest';

import { type Quote } from '@sarwa/contracts';
import { changeBps, dollarsToTicks } from '@sarwa/domain';

import { MarketService } from '../src/market/market.service';
import { PrismaService } from '../src/prisma.service';
import { ExecutionQueue } from '../src/trading/execution-queue';
import { FakeClock, pinned, startApp } from './app';

// Tuesday 1 Dec 2026, 10:00 in New York.
const T0 = Date.UTC(2026, 11, 1, 15, 0);
const DAY = 86_400_000;

const clock = new FakeClock(T0);
let app: INestApplication;
let market: MarketService;

async function boot(): Promise<void> {
  ({ app } = await startApp({ clock, random: pinned.random, ticker: pinned.ticker }));
  market = app.get(MarketService);
}

async function restart(): Promise<void> {
  await market.persistPrices();
  await app.close();
  await boot();
}

const changeOf = (quote: Quote) =>
  changeBps(dollarsToTicks(quote.prevClose), dollarsToTicks(quote.price));

beforeAll(async () => {
  await boot();
  const http = request(app.getHttpServer());
  const res = await http
    .post('/api/v1/admin/auth/login')
    .set('X-Forwarded-For', '198.21.0.1')
    .send({ email: 'admin@sarwa.dev', password: 'admin12345', remember: false })
    .expect(200);
  const cookie = ([] as string[]).concat(res.headers['set-cookie'] ?? [])[0]!.split(';')[0]!;
  await http
    .patch('/api/v1/admin/trading')
    .set('Cookie', cookie)
    .set('X-Forwarded-For', '127.0.0.1')
    .send({ sessionMode: 'always-open' })
    .expect(200);
});

afterAll(async () => {
  await app.close();
});

describe('restart', () => {
  it("keeps today's change, open and range across a restart", async () => {
    market.movePrice('NFLX', 800);
    // A new trading day: 800 becomes the previous close.
    clock.set(T0 + DAY);
    market.tick();
    market.movePrice('NFLX', 840);
    market.movePrice('NFLX', 830);
    const before = market.quoteOf('NFLX')!;

    await restart();
    const after = market.quoteOf('NFLX')!;

    expect(before).toMatchObject({ price: 830, prevClose: 800, open: 800, dayHigh: 840 });
    expect(after).toMatchObject({
      price: 830,
      prevClose: 800,
      open: 800,
      dayHigh: 840,
      dayLow: 800,
    });
    expect(changeOf(after)).toBe(changeOf(before));
  });

  it('rolls the day over on the first tick when it restarts on a new day', async () => {
    clock.set(T0 + 2 * DAY);
    await restart();

    market.tick();

    expect(market.quoteOf('NFLX')).toMatchObject({ price: 830, prevClose: 830, open: 830 });
  });

  it('resumes a halt that ran out while the server was down and audits it as the system', async () => {
    const halt = await app.get(PrismaService).halt.create({
      data: {
        symbol: 'ORCL',
        source: 'admin',
        message: 'News pending',
        since: new Date(clock.now() - 60_000),
        resumesAt: new Date(clock.now() - 1),
        createdBy: 'admin@sarwa.dev',
      },
    });

    await restart();
    // The overdue resume is scheduled with a zero-delay timer at boot.
    await new Promise((resolve) => setTimeout(resolve, 10));
    await app.get(ExecutionQueue).idle();

    const prisma = app.get(PrismaService);
    const row = await prisma.halt.findUniqueOrThrow({ where: { id: halt.id } });
    const audit = await prisma.auditLog.findFirst({
      where: { action: 'halt.resume', entity: 'Halt · ORCL' },
      orderBy: { createdAt: 'desc' },
    });
    expect(row.endedAt).not.toBeNull();
    expect(audit).toMatchObject({ actorEmail: 'system', ip: null });
    expect(JSON.parse(audit!.payload)).toMatchObject({ before: { symbol: 'ORCL' }, after: null });
  });

  it('finishes queued order work before shutting down', async () => {
    let finished = false;
    void app.get(ExecutionQueue).run(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      finished = true;
    });

    await app.close();

    expect(finished).toBe(true);
    await boot();
  });
});
