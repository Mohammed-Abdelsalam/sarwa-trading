import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

import {
  applyFill,
  cents,
  DEFAULT_CIRCUIT_BREAKER,
  DEFAULT_EXECUTION_RULES,
  dollarsToTicks,
  micros,
  POLICY,
  type Position,
  sharesToMicros,
  type Side,
} from '@sarwa/domain';

const prisma = new PrismaClient();

const STOCKS: [string, string, string, string, number, number, number | null, number][] = [
  ['AAPL', 'Apple Inc.', 'tech', 'NASDAQ', 231.48, 3.52e12, 35.1, 1.0],
  ['MSFT', 'Microsoft Corp.', 'tech', 'NASDAQ', 438.12, 3.26e12, 36.8, 0.9],
  ['NVDA', 'NVIDIA Corp.', 'tech', 'NASDAQ', 142.87, 3.5e12, 56.2, 2.2],
  ['TSLA', 'Tesla Inc.', 'consumer', 'NASDAQ', 248.35, 796.4e9, 68.9, 2.6],
  ['AMZN', 'Amazon.com Inc.', 'consumer', 'NASDAQ', 207.91, 2.18e12, 44.3, 1.2],
  ['GOOGL', 'Alphabet Inc. Cl A', 'media', 'NASDAQ', 178.24, 2.19e12, 23.6, 1.4],
  ['META', 'Meta Platforms', 'media', 'NASDAQ', 584.6, 1.48e12, 27.4, 0.8],
  ['JPM', 'JPMorgan Chase & Co.', 'fin', 'NYSE', 241.33, 679.2e9, 13.4, 0.7],
  ['V', 'Visa Inc. Cl A', 'fin', 'NYSE', 312.08, 602.7e9, 32.0, 1.1],
  ['XOM', 'Exxon Mobil Corp.', 'energy', 'NYSE', 116.52, 512e9, 14.5, 0.6],
  ['JNJ', 'Johnson & Johnson', 'health', 'NYSE', 152.19, 366.4e9, 25.3, 0.5],
  ['KO', 'Coca-Cola Co.', 'consumer', 'NYSE', 68.74, 296.1e9, 28.6, 1.8],
  ['NFLX', 'Netflix Inc.', 'media', 'NASDAQ', 812.45, 347.6e9, 45.9, 2.0],
  ['AMD', 'Advanced Micro Devices', 'tech', 'NASDAQ', 156.02, 252.8e9, 138.1, 0.9],
  ['DIS', 'Walt Disney Co.', 'media', 'NYSE', 112.67, 204.1e9, 41.5, 0.8],
  ['BAC', 'Bank of America', 'fin', 'NYSE', 44.81, 345.5e9, 16.2, 1.0],
  ['CVX', 'Chevron Corp.', 'energy', 'NYSE', 158.4, 284.9e9, 17.3, 1.3],
  ['UNH', 'UnitedHealth Group', 'health', 'NYSE', 548.2, 505e9, 35.4, 1.1],
  ['PFE', 'Pfizer Inc.', 'health', 'NYSE', 26.93, 152.6e9, 36.4, 0.9],
  ['WMT', 'Walmart Inc.', 'consumer', 'NYSE', 86.35, 694.3e9, 37.8, 1.5],
  ['NKE', 'Nike Inc. Cl B', 'consumer', 'NYSE', 77.18, 115.6e9, 22.1, 2.4],
  ['INTC', 'Intel Corp.', 'tech', 'NASDAQ', 23.47, 101.2e9, null, 1.0],
];

// The demo passwords are public, so production must provide its own.
function fromEnv(name: string, demoValue: string): string {
  const value = process.env[name];
  if (value) return value;
  if (process.env.NODE_ENV === 'production') throw new Error(`Set ${name} to seed production`);
  return demoValue;
}

// Idempotent: existing rows are kept, so admin edits survive restarts.
async function main(): Promise<void> {
  const admins = [
    {
      email: fromEnv('ADMIN_EMAIL', 'admin@sarwa.dev'),
      password: fromEnv('ADMIN_PASSWORD', 'admin12345'),
      name: 'Demo Admin',
      role: 'ADMIN',
    },
    {
      email: fromEnv('VIEWER_EMAIL', 'viewer@sarwa.dev'),
      password: fromEnv('VIEWER_PASSWORD', 'viewer12345'),
      name: 'Demo Viewer',
      role: 'VIEWER',
    },
  ];

  for (const [
    symbol,
    name,
    sector,
    exchange,
    basePrice,
    marketCap,
    peRatio,
    volatility,
  ] of STOCKS) {
    await prisma.stock.upsert({
      where: { symbol },
      update: {},
      create: { symbol, name, sector, exchange, basePrice, marketCap, peRatio, volatility },
    });
  }

  for (const { email, password, name, role } of admins) {
    await prisma.adminUser.upsert({
      where: { email },
      update: {},
      create: { email, name, role, passwordHash: await bcrypt.hash(password, 10) },
    });
  }

  await prisma.appConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  await prisma.tradingConfig.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      tradingEnabled: true,
      sessionMode: 'always-open',
      rules: JSON.stringify(DEFAULT_EXECUTION_RULES),
      circuitBreaker: JSON.stringify(DEFAULT_CIRCUIT_BREAKER),
    },
  });
  const accounts = await seedDemoAccounts();
  console.log(
    `[seed] ${STOCKS.length} stocks, ${admins.length} admins, ${accounts} demo accounts, configs ready`,
  );
}

type DemoTrade = [symbol: string, side: Side, shares: number];

const DEMO_ACCOUNTS: { deviceId: string; handle: string; trades: DemoTrade[] }[] = [
  {
    deviceId: '5eed0000-0000-4000-8000-000000000001',
    handle: 'ACC-5EED01',
    trades: [
      ['AAPL', 'buy', 40],
      ['NVDA', 'buy', 120],
      ['AAPL', 'sell', 10],
    ],
  },
  {
    deviceId: '5eed0000-0000-4000-8000-000000000002',
    handle: 'ACC-5EED02',
    trades: [
      ['MSFT', 'buy', 30],
      ['JPM', 'buy', 50],
      ['XOM', 'buy', 100],
    ],
  },
  {
    deviceId: '5eed0000-0000-4000-8000-000000000003',
    handle: 'ACC-5EED03',
    trades: [
      ['TSLA', 'buy', 60],
      ['TSLA', 'sell', 60],
      ['KO', 'buy', 200],
    ],
  },
  {
    deviceId: '5eed0000-0000-4000-8000-000000000004',
    handle: 'ACC-5EED04',
    trades: [
      ['META', 'buy', 25],
      ['NFLX', 'buy', 12],
      ['PFE', 'buy', 400],
      ['META', 'sell', 5],
    ],
  },
];

// Demo books built with the same domain functions the engine uses, so they always balance.
async function seedDemoAccounts(): Promise<number> {
  const prices = new Map(STOCKS.map(([symbol, , , , basePrice]) => [symbol, basePrice]));
  const now = Date.now();
  let created = 0;
  for (const { deviceId, handle, trades } of DEMO_ACCOUNTS) {
    if (await prisma.account.findUnique({ where: { deviceId } })) continue;
    await prisma.device.upsert({ where: { id: deviceId }, update: {}, create: { id: deviceId } });
    const openedAt = new Date(now - 7 * 86_400_000);
    const account = await prisma.account.create({
      data: {
        deviceId,
        handle,
        cashCents: BigInt(POLICY.startingCashCents),
        createdAt: openedAt,
      },
    });

    let cashCents = POLICY.startingCashCents;
    const positions = new Map<string, Position>();
    for (const [index, [symbol, side, shares]] of trades.entries()) {
      const priceTicks = dollarsToTicks(prices.get(symbol) ?? 1);
      const qtyMicros = sharesToMicros(shares);
      const at = new Date(openedAt.getTime() + (index + 1) * 86_400_000);
      const result = applyFill(
        cashCents,
        positions.get(symbol) ?? null,
        {
          side,
          type: 'market',
          status: 'open',
          qtyMicros,
          amountCents: null,
          limitTicks: null,
          stopTicks: null,
          filledMicros: micros(0),
          filledNotionalCents: cents(0),
          filledExactNotional: 0n,
          heldCents: cents(0),
          heldMicros: micros(0),
          holdPriceTicks: priceTicks,
          holdBudgetCents: null,
        },
        symbol,
        { qtyMicros, priceTicks },
      );
      cashCents = result.cashCents;
      if (result.position) positions.set(symbol, result.position);
      else positions.delete(symbol);

      await prisma.order.create({
        data: {
          accountId: account.id,
          epoch: 0,
          symbol,
          side,
          type: 'market',
          tif: 'day',
          status: result.order.status,
          qtyMicros: BigInt(qtyMicros),
          quotedTicks: BigInt(priceTicks),
          filledMicros: BigInt(result.order.filledMicros),
          filledNotionalCents: BigInt(result.order.filledNotionalCents),
          filledExactNotional: result.order.filledExactNotional.toString(),
          idempotencyKey: `seed-${handle}-${index}`,
          requestHash: 'seed',
          latencyMs: 4,
          createdAt: at,
          updatedAt: at,
          closedAt: at,
          fills: {
            create: {
              accountId: account.id,
              epoch: 0,
              symbol,
              side,
              qtyMicros: BigInt(qtyMicros),
              priceTicks: BigInt(priceTicks),
              notionalCents: BigInt(result.notionalCents),
              realizedCents: BigInt(result.realizedCents),
              at,
            },
          },
        },
      });
    }

    await prisma.account.update({
      where: { id: account.id },
      data: { cashCents: BigInt(cashCents) },
    });
    for (const position of positions.values()) {
      await prisma.position.create({
        data: {
          accountId: account.id,
          symbol: position.symbol,
          qtyMicros: BigInt(position.qtyMicros),
          costBasisCents: BigInt(position.costBasisCents),
        },
      });
    }
    created++;
  }
  return created;
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
