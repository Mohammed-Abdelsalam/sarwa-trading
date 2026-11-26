import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

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

// Idempotent: existing rows are kept, so admin edits survive restarts.
async function main(): Promise<void> {
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

  const admins = [
    {
      email: process.env.ADMIN_EMAIL ?? 'admin@sarwa.dev',
      password: process.env.ADMIN_PASSWORD ?? 'admin12345',
      name: 'Demo Admin',
      role: 'ADMIN',
    },
    {
      email: process.env.VIEWER_EMAIL ?? 'viewer@sarwa.dev',
      password: process.env.VIEWER_PASSWORD ?? 'viewer12345',
      name: 'Demo Viewer',
      role: 'VIEWER',
    },
  ];
  for (const { email, password, name, role } of admins) {
    await prisma.adminUser.upsert({
      where: { email },
      update: {},
      create: { email, name, role, passwordHash: await bcrypt.hash(password, 10) },
    });
  }

  await prisma.appConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  console.log(`[seed] ${STOCKS.length} stocks, ${admins.length} admins, app config ready`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
