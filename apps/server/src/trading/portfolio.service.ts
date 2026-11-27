import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { type Account as AccountRow } from '@prisma/client';

import {
  type EquityPeriod,
  type EquityResponse,
  type PortfolioPosition,
  type PortfolioResponse,
} from '@sarwa/contracts';
import {
  addDays,
  cents,
  dollarsToTicks,
  marketClock,
  marketTime,
  micros,
  POLICY,
  type PortfolioSummary,
  previousTradingDay,
  summarizePortfolio,
  ticks,
} from '@sarwa/domain';

import { Clock } from '../common/clock';
import { MarketService } from '../market/market.service';
import { PrismaService } from '../prisma.service';
import { TradingConfigService } from '../trading-config/trading-config.service';
import { toAccount, toHold, WORKING_STATUSES } from './mappers';

const DAY_MS = 86_400_000;
const PERIOD_MS: Record<EquityPeriod, number> = {
  '1D': DAY_MS,
  '1W': 7 * DAY_MS,
  '1M': 30 * DAY_MS,
  '1Y': 365 * DAY_MS,
  ALL: Number.POSITIVE_INFINITY,
};
const MAX_POINTS = 300;

@Injectable()
export class PortfolioService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PortfolioService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly market: MarketService,
    private readonly config: TradingConfigService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      this.takeSnapshots().catch((error: unknown) => {
        this.logger.warn(`Snapshots failed: ${String(error)}`);
      });
    }, POLICY.snapshotIntervalMs);
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  // The raw books; clients value them with live prices through @sarwa/domain.
  async books(account: AccountRow): Promise<PortfolioResponse> {
    const now = this.clock.now();
    const today = marketClock(now).date;
    const scope = { accountId: account.id, epoch: account.epoch };
    const [positions, working, todayFills, ytd, equityAtLastCloseCents] = await Promise.all([
      this.prisma.position.findMany({
        where: { accountId: account.id },
        orderBy: { symbol: 'asc' },
      }),
      this.prisma.order.findMany({
        where: { accountId: account.id, status: { in: [...WORKING_STATUSES] } },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.fill.findMany({
        where: { ...scope, at: { gte: new Date(marketTime(today, 0)) } },
      }),
      this.prisma.fill.aggregate({
        _sum: { realizedCents: true },
        where: { ...scope, at: { gte: new Date(marketTime(`${today.slice(0, 4)}-01-01`, 0)) } },
      }),
      this.equityAtLastClose(account, now),
    ]);

    return {
      account: toAccount(account),
      positions: positions.map((row): PortfolioPosition => {
        const qtyMicros = Number(row.qtyMicros);
        const fills = todayFills.filter((fill) => fill.symbol === row.symbol);
        const sum = (side: string, field: 'qtyMicros' | 'notionalCents') =>
          fills.filter((f) => f.side === side).reduce((total, f) => total + Number(f[field]), 0);
        return {
          symbol: row.symbol,
          sector: this.market.sectorOf(row.symbol),
          qtyMicros,
          costBasisCents: Number(row.costBasisCents),
          today:
            fills.length === 0
              ? null
              : {
                  qtyAtOpenMicros: qtyMicros - sum('buy', 'qtyMicros') + sum('sell', 'qtyMicros'),
                  boughtCents: sum('buy', 'notionalCents'),
                  soldCents: sum('sell', 'notionalCents'),
                },
        };
      }),
      holds: working.map(toHold),
      realizedYtdCents: Number(ytd._sum.realizedCents ?? 0n),
      equityAtLastCloseCents,
      asOf: now,
    };
  }

  async summary(account: AccountRow): Promise<PortfolioSummary> {
    const books = await this.books(account);
    const { equityAtLastCloseCents } = books;
    return summarizePortfolio({
      cashCents: cents(books.account.cashCents),
      startingCashCents: cents(books.account.startingCashCents),
      holds: books.holds.map((hold) => ({
        ...hold,
        heldCents: cents(hold.heldCents),
        heldMicros: micros(hold.heldMicros),
      })),
      realizedYtdCents: cents(books.realizedYtdCents),
      equityAtLastCloseCents:
        equityAtLastCloseCents === null ? null : cents(equityAtLastCloseCents),
      positions: books.positions.map((p) => {
        const quote = this.market.quoteOf(p.symbol);
        return {
          position: {
            symbol: p.symbol,
            qtyMicros: micros(p.qtyMicros),
            costBasisCents: cents(p.costBasisCents),
          },
          sector: p.sector,
          lastTicks: quote ? dollarsToTicks(quote.price) : ticks(0),
          prevCloseTicks: quote ? dollarsToTicks(quote.prevClose) : ticks(0),
          ...(p.today && {
            today: {
              qtyAtOpenMicros: micros(p.today.qtyAtOpenMicros),
              boughtCents: cents(p.today.boughtCents),
              soldCents: cents(p.today.soldCents),
            },
          }),
        };
      }),
    });
  }

  async equity(account: AccountRow, period: EquityPeriod): Promise<EquityResponse> {
    const now = this.clock.now();
    const epochStart = (account.resetAt ?? account.createdAt).getTime();
    const start = Math.max(epochStart, now - PERIOD_MS[period]);
    const rows = await this.prisma.portfolioSnapshot.findMany({
      where: { accountId: account.id, epoch: account.epoch, t: { gte: new Date(start) } },
      orderBy: { t: 'asc' },
    });
    const bucketMs = Math.max(1, (now - start) / MAX_POINTS);
    const sampled = new Map<number, { t: number; equityCents: number }>();
    for (const row of rows) {
      const t = row.t.getTime();
      sampled.set(Math.floor((t - start) / bucketMs), { t, equityCents: Number(row.equityCents) });
    }
    const { equityCents } = await this.summary(account);
    return {
      period,
      points: [
        ...(epochStart >= start ? [{ t: epochStart, equityCents: POLICY.startingCashCents }] : []),
        ...sampled.values(),
        { t: now, equityCents },
      ],
    };
  }

  // Equity is recorded only for accounts that can move: cash alone has no P&L.
  async takeSnapshots(): Promise<number> {
    const accounts = await this.prisma.account.findMany({
      where: {
        OR: [
          { positions: { some: {} } },
          { orders: { some: { status: { in: [...WORKING_STATUSES] } } } },
        ],
      },
    });
    const t = new Date(this.clock.now());
    for (const account of accounts) {
      const { equityCents } = await this.summary(account);
      await this.prisma.portfolioSnapshot.create({
        data: { accountId: account.id, epoch: account.epoch, t, equityCents: BigInt(equityCents) },
      });
    }
    return accounts.length;
  }

  // Equity at the previous session's close; null when the books didn't exist yet.
  private async equityAtLastClose(account: AccountRow, now: number): Promise<number | null> {
    const today = marketClock(now).date;
    const closedAt =
      this.config.get().sessionMode === 'always-open'
        ? marketTime(today, 0)
        : previousTradingDay(addDays(today, -1)).closesAt;
    if ((account.resetAt ?? account.createdAt).getTime() > closedAt) return null;
    const snapshot = await this.prisma.portfolioSnapshot.findFirst({
      where: { accountId: account.id, epoch: account.epoch, t: { lte: new Date(closedAt) } },
      orderBy: { t: 'desc' },
    });
    return snapshot ? Number(snapshot.equityCents) : null;
  }
}
