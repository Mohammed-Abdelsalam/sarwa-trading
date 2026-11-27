import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';

import {
  type Account,
  ADMIN_ROUTES,
  type AdminAccountsResponse,
  AdminAccountsQuerySchema,
  type AdminOrderStats,
  type AdminOrdersResponse,
  AdminOrdersQuerySchema,
  type AdminTrading,
  type CreateHalt,
  CreateHaltSchema,
  type Halt,
  type HaltDuration,
  type HaltImpact,
  type RejectionWire,
  type ResetAccount,
  ResetAccountSchema,
  SymbolSchema,
  type UpdateTrading,
  UpdateTradingSchema,
} from '@sarwa/contracts';
import { marketClock, marketSession, marketTime, ORDER_TYPES, ratioBps } from '@sarwa/domain';

import { type Actor, AuditService } from '../admin/audit.service';
import { AdminGuard, CurrentActor, Roles } from '../admin/auth';
import { Clock } from '../common/clock';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { MarketService } from '../market/market.service';
import { PrismaService } from '../prisma.service';
import { TradingConfigService } from '../trading-config/trading-config.service';
import { AdminAccountsService } from './admin-accounts.service';
import { ExecutionQueue } from './execution-queue';
import { HaltsService } from './halts.service';
import { toOrder } from './mappers';
import { StatusService } from './status.service';

const MINUTE_MS = 60_000;

@Controller()
@UseGuards(AdminGuard)
export class AdminTradingController {
  constructor(
    private readonly clock: Clock,
    private readonly queue: ExecutionQueue,
    private readonly market: MarketService,
    private readonly config: TradingConfigService,
    private readonly halts: HaltsService,
    private readonly status: StatusService,
    private readonly audit: AuditService,
  ) {}

  @Get(ADMIN_ROUTES.trading)
  trading(): AdminTrading {
    return this.status.admin();
  }

  @Patch(ADMIN_ROUTES.trading)
  @Roles(['ADMIN'])
  async update(
    @Body(new ZodValidationPipe(UpdateTradingSchema)) patch: UpdateTrading,
    @CurrentActor() actor: Actor,
  ): Promise<AdminTrading> {
    await this.config.update(patch, actor);
    return this.status.admin();
  }

  @Get(ADMIN_ROUTES.haltImpact)
  async impact(
    @Query(new ZodValidationPipe(z.object({ symbol: SymbolSchema })))
    { symbol }: { symbol: string },
  ): Promise<HaltImpact> {
    const { accountIds, openOrders } = await this.halts.affectedAccounts(symbol);
    return { symbol, openOrders, holdersAndWatchers: accountIds.length };
  }

  @Post(ADMIN_ROUTES.halts)
  @Roles(['ADMIN'])
  halt(
    @Body(new ZodValidationPipe(CreateHaltSchema)) input: CreateHalt,
    @CurrentActor() actor: Actor,
  ): Promise<Halt> {
    if (!this.market.quoteOf(input.symbol))
      throw new NotFoundException(`Unknown symbol ${input.symbol}`);
    return this.queue.run(async () => {
      if (this.halts.isHalted(input.symbol)) {
        throw new ConflictException(`${input.symbol} is already halted`);
      }
      const halt = await this.halts.halt(
        {
          symbol: input.symbol,
          source: 'admin',
          message: input.message,
          resumesAt: this.resumesAt(input.duration),
          createdBy: actor.email,
        },
        (tx, created) =>
          this.audit.log(
            {
              actorEmail: actor.email,
              action: 'halt.create',
              entity: `Halt · ${input.symbol}`,
              payload: { before: null, after: { ...created, notify: input.notify } },
              ip: actor.ip,
            },
            tx,
          ),
      );
      if (input.notify) await this.halts.notifyAffected(halt);
      return halt;
    });
  }

  @Post(ADMIN_ROUTES.resumeHalt)
  @Roles(['ADMIN'])
  @HttpCode(204)
  resume(
    @Param('symbol', new ZodValidationPipe(SymbolSchema)) symbol: string,
    @CurrentActor() actor: Actor,
  ): Promise<void> {
    return this.queue.run(async () => {
      const resumed = await this.halts.resume(symbol, (tx, halt) =>
        this.audit.log(
          {
            actorEmail: actor.email,
            action: 'halt.resume',
            entity: `Halt · ${symbol}`,
            payload: { before: halt, after: null },
            ip: actor.ip,
          },
          tx,
        ),
      );
      if (!resumed) throw new NotFoundException(`${symbol} is not halted`);
    });
  }

  private resumesAt(duration: HaltDuration): number | null {
    const now = this.clock.now();
    switch (duration) {
      case '5m':
        return now + 5 * MINUTE_MS;
      case '15m':
        return now + 15 * MINUTE_MS;
      case 'until_close':
        return marketSession(now, this.config.get().sessionMode).closesAt;
      case 'manual':
        return null;
    }
  }
}

@Controller()
@UseGuards(AdminGuard)
export class AdminOrdersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  @Get(ADMIN_ROUTES.orders)
  async list(
    @Query(new ZodValidationPipe(AdminOrdersQuerySchema))
    query: z.output<typeof AdminOrdersQuerySchema>,
  ): Promise<AdminOrdersResponse> {
    const rows = await this.prisma.order.findMany({
      where: query.status ? { status: query.status } : {},
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit,
      include: { fills: true, account: { select: { handle: true } } },
    });
    return {
      items: rows.map((row) => ({
        ...toOrder(row),
        accountHandle: row.account.handle,
        latencyMs: row.latencyMs,
      })),
    };
  }

  // Today in New York, the exchange's day.
  @Get(ADMIN_ROUTES.orderStats)
  async stats(): Promise<AdminOrderStats> {
    const since = new Date(marketTime(marketClock(this.clock.now()).date, 0));
    const [orders, notional] = await Promise.all([
      this.prisma.order.findMany({
        where: { createdAt: { gte: since } },
        select: { status: true, type: true, rejection: true, amountCents: true, accountId: true },
      }),
      this.prisma.fill.aggregate({ _sum: { notionalCents: true }, where: { at: { gte: since } } }),
    ]);
    const count = (predicate: (order: (typeof orders)[number]) => boolean) =>
      orders.filter(predicate).length;
    const reasons = new Map<RejectionWire['code'], number>();
    for (const order of orders) {
      if (!order.rejection) continue;
      const { code } = JSON.parse(order.rejection) as RejectionWire;
      reasons.set(code, (reasons.get(code) ?? 0) + 1);
    }
    return {
      ordersToday: orders.length,
      fillRateBps: ratioBps(
        count((o) => o.status === 'filled'),
        orders.length,
      ),
      rejectedBps: ratioBps(
        count((o) => o.status === 'rejected'),
        orders.length,
      ),
      notionalTodayCents: Number(notional._sum.notionalCents ?? 0n),
      activeTraders: new Set(orders.map((o) => o.accountId)).size,
      rejectionsByReason: [...reasons]
        .map(([code, total]) => ({ code, count: total }))
        .sort((a, b) => b.count - a.count),
      typeMix: ORDER_TYPES.map((type) => ({ type, count: count((o) => o.type === type) })),
      amountOrders: count((o) => o.amountCents !== null),
    };
  }
}

@Controller()
@UseGuards(AdminGuard)
export class AdminAccountsController {
  constructor(private readonly accounts: AdminAccountsService) {}

  @Get(ADMIN_ROUTES.accounts)
  list(
    @Query(new ZodValidationPipe(AdminAccountsQuerySchema))
    query: z.output<typeof AdminAccountsQuerySchema>,
  ): Promise<AdminAccountsResponse> {
    return this.accounts.list(query);
  }

  @Post(ADMIN_ROUTES.resetAccount)
  @Roles(['ADMIN'])
  @HttpCode(200)
  reset(
    @Param('id', new ZodValidationPipe(z.string().min(1).max(64))) id: string,
    @Body(new ZodValidationPipe(ResetAccountSchema)) { confirm }: ResetAccount,
    @CurrentActor() actor: Actor,
  ): Promise<Account> {
    return this.accounts.reset(id, confirm, actor);
  }
}
