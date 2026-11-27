import {
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import {
  type Account as AccountRow,
  type Fill as FillRow,
  type Position as PositionRow,
} from '@prisma/client';

import {
  type EquityPeriod,
  type EquityResponse,
  type PortfolioPosition,
  type PortfolioResponse,
} from '@sarwa/contracts';
import {
  addDays,
  averageCostTicks,
  cents,
  dollarsToTicks,
  marketClock,
  marketTime,
  micros,
  POLICY,
  type PortfolioSummary,
  previousTradingDay,
  summarizePortfolio,
  todayActivity,
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
// Keeps every IN list well under SQLite's bound-parameter limit.
const BATCH_SIZE = 500;
const SNAPSHOT_RETENTION = [
  { after: 2 * DAY_MS, bucketMs: DAY_MS / 24 },
  { after: 90 * DAY_MS, bucketMs: DAY_MS },
] as const;

type AccountKey = Pick<AccountRow, 'id'>;

interface AccountBooks {
  row: AccountRow;
  books: PortfolioResponse;
}

@Injectable()
export class PortfolioService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PortfolioService.name);
  private timer?: NodeJS.Timeout;
  private compactedAt = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly market: MarketService,
    private readonly config: TradingConfigService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      this.takeSnapshots()
        .then(() => this.compactHourly())
        .catch((error: unknown) => {
          this.logger.warn(`Snapshots failed: ${String(error)}`);
        });
    }, POLICY.snapshotIntervalMs);
  }

  private async compactHourly(): Promise<void> {
    const now = this.clock.now();
    if (now - this.compactedAt < DAY_MS / 24) return;
    this.compactedAt = now;
    await this.compactSnapshots();
  }

  // Keeps the latest snapshot per hour after 2 days and per day after 90, so a year of equity
  // stays a few thousand rows. Times are integer milliseconds in SQLite, so buckets are a division.
  async compactSnapshots(): Promise<number> {
    const now = this.clock.now();
    let removed = 0;
    for (const { after, bucketMs } of SNAPSHOT_RETENTION) {
      const cutoff = now - after;
      removed += await this.prisma.$executeRaw`
        DELETE FROM "PortfolioSnapshot"
        WHERE "t" < ${cutoff} AND "id" NOT IN (
          SELECT MAX("id") FROM "PortfolioSnapshot" WHERE "t" < ${cutoff}
          GROUP BY "accountId", "epoch", "t" / ${bucketMs}
        )`;
    }
    return removed;
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  // The raw books; clients value them with live prices through @sarwa/domain.
  async books(accountId: string): Promise<PortfolioResponse> {
    const [books] = await this.booksFor([{ id: accountId }]);
    if (!books) throw new NotFoundException('Account not found');
    return books;
  }

  async summary(accountId: string): Promise<PortfolioSummary> {
    return (await this.snapshot(accountId)).summary;
  }

  // The raw books and their live valuation from one read.
  async snapshot(
    accountId: string,
  ): Promise<{ books: PortfolioResponse; summary: PortfolioSummary }> {
    const books = await this.books(accountId);
    return { books, summary: this.summarize(books) };
  }

  async summaries(accounts: readonly AccountKey[]): Promise<Map<string, PortfolioSummary>> {
    const books = await this.booksFor(accounts);
    return new Map(books.map((entry) => [entry.account.id, this.summarize(entry)]));
  }

  // A fixed number of queries for any number of accounts; an account deleted meanwhile is skipped.
  // The reads share one short batch transaction, so a fill can't land between cash and holds.
  async booksFor(requested: readonly AccountKey[]): Promise<PortfolioResponse[]> {
    return (await this.read(requested)).map((entry) => entry.books);
  }

  private async read(requested: readonly AccountKey[]): Promise<AccountBooks[]> {
    const entries: AccountBooks[] = [];
    for (let start = 0; start < requested.length; start += BATCH_SIZE) {
      entries.push(...(await this.readBatch(requested.slice(start, start + BATCH_SIZE))));
    }
    return entries;
  }

  private async readBatch(requested: readonly AccountKey[]): Promise<AccountBooks[]> {
    const now = this.clock.now();
    const today = marketClock(now).date;
    const ids = requested.map((account) => account.id);
    const ofAccounts = { accountId: { in: ids } };
    const [accounts, positions, working, todayFills, ytd] = await this.prisma.$transaction([
      this.prisma.account.findMany({ where: { id: { in: ids } } }),
      this.prisma.position.findMany({ where: ofAccounts, orderBy: { symbol: 'asc' } }),
      this.prisma.order.findMany({
        where: { ...ofAccounts, status: { in: [...WORKING_STATUSES] } },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.fill.findMany({
        where: { ...ofAccounts, at: { gte: new Date(marketTime(today, 0)) } },
      }),
      this.prisma.fill.groupBy({
        by: ['accountId', 'epoch'],
        where: {
          ...ofAccounts,
          at: { gte: new Date(marketTime(`${today.slice(0, 4)}-01-01`, 0)) },
        },
        orderBy: { accountId: 'asc' },
        _sum: { realizedCents: true },
      }),
    ]);
    const equityAtLastClose = await this.equitiesAtLastClose(accounts, now);
    const byId = new Map(accounts.map((account) => [account.id, account]));
    const positionsOf = groupByAccount(positions);
    const workingOf = groupByAccount(working);
    const fillsOf = groupByAccount(todayFills);
    const realizedOf = new Map(
      ytd.map((r) => [`${r.accountId}:${String(r.epoch)}`, Number(r._sum.realizedCents ?? 0n)]),
    );

    return requested.flatMap((requester): AccountBooks[] => {
      const row = byId.get(requester.id);
      if (!row) return [];
      const fills = (fillsOf.get(row.id) ?? []).filter((f) => f.epoch === row.epoch);
      const books: PortfolioResponse = {
        account: toAccount(row),
        positions: (positionsOf.get(row.id) ?? []).map((p) => this.toPosition(p, fills)),
        holds: (workingOf.get(row.id) ?? []).map(toHold),
        realizedYtdCents: realizedOf.get(`${row.id}:${String(row.epoch)}`) ?? 0,
        equityAtLastCloseCents: equityAtLastClose.get(row.id) ?? null,
        asOf: now,
      };
      return [{ row, books }];
    });
  }

  private toPosition(row: PositionRow, todayFills: readonly FillRow[]): PortfolioPosition {
    const qtyMicros = Number(row.qtyMicros);
    return {
      symbol: row.symbol,
      sector: this.market.sectorOf(row.symbol),
      qtyMicros,
      costBasisCents: Number(row.costBasisCents),
      today: todayActivity(todayFills, { symbol: row.symbol, qtyMicros: micros(qtyMicros) }),
    };
  }

  private summarize(books: PortfolioResponse): PortfolioSummary {
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
        const position = {
          symbol: p.symbol,
          qtyMicros: micros(p.qtyMicros),
          costBasisCents: cents(p.costBasisCents),
        };
        const fallback = averageCostTicks(position);
        return {
          position,
          sector: p.sector,
          lastTicks: quote ? dollarsToTicks(quote.price) : fallback,
          prevCloseTicks: quote ? dollarsToTicks(quote.prevClose) : fallback,
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

  async equity(accountId: string, period: EquityPeriod): Promise<EquityResponse> {
    const account = await this.prisma.account.findUnique({ where: { id: accountId } });
    if (!account) throw new NotFoundException('Account not found');
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
    const { equityCents } = await this.summary(accountId);
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
    const entries = await this.read(accounts);
    await this.prisma.portfolioSnapshot.createMany({
      data: entries.map(({ row, books }) => ({
        accountId: row.id,
        epoch: row.epoch,
        t,
        equityCents: BigInt(this.summarize(books).equityCents),
      })),
    });
    return entries.length;
  }

  // Equity at the previous session's close, by account id; absent when the books didn't exist yet.
  private async equitiesAtLastClose(
    accounts: readonly AccountRow[],
    now: number,
  ): Promise<Map<string, number>> {
    const today = marketClock(now).date;
    const closedAt =
      this.config.get().sessionMode === 'always-open'
        ? marketTime(today, 0)
        : previousTradingDay(addDays(today, -1)).closesAt;
    const open = accounts.filter((a) => (a.resetAt ?? a.createdAt).getTime() <= closedAt);
    if (open.length === 0) return new Map();
    const epochOf = new Map(open.map((account) => [account.id, account.epoch]));
    const latest = await this.prisma.portfolioSnapshot.groupBy({
      by: ['accountId', 'epoch'],
      where: { accountId: { in: [...epochOf.keys()] }, t: { lte: new Date(closedAt) } },
      orderBy: { accountId: 'asc' },
      _max: { t: true },
    });
    const keys = latest.flatMap(({ accountId, epoch, _max }) =>
      _max.t && epochOf.get(accountId) === epoch ? [{ accountId, epoch, t: _max.t }] : [],
    );
    if (keys.length === 0) return new Map();
    const snapshots = await this.prisma.portfolioSnapshot.findMany({ where: { OR: keys } });
    return new Map(snapshots.map((row) => [row.accountId, Number(row.equityCents)]));
  }
}

function groupByAccount<T extends { accountId: string }>(rows: readonly T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const group = groups.get(row.accountId);
    if (group) group.push(row);
    else groups.set(row.accountId, [row]);
  }
  return groups;
}
