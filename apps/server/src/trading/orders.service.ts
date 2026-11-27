import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { type Account as AccountRow, type Prisma } from '@prisma/client';

import {
  type CancelOrderResponse,
  type ModifyOrderRequest,
  type Order,
  type OrdersQuery,
  type OrdersResponse,
  type PlaceOrderRequest,
  type Quote,
  toDomain,
} from '@sarwa/contracts';
import {
  buyingPowerCents,
  cancelOutcome,
  cents,
  estimateOrder,
  type OrderContext,
  type OrderDraft,
  type OrderEstimate,
  orderExpiry,
  marketSession,
  micros,
  type OrderSize,
  sellableMicros,
  ticks,
  validateOrder,
} from '@sarwa/domain';

import { Clock } from '../common/clock';
import { MarketService } from '../market/market.service';
import { PrismaService } from '../prisma.service';
import { TradingConfigService } from '../trading-config/trading-config.service';
import { ExecutionQueue } from './execution-queue';
import { ExecutionService } from './execution.service';
import { HaltsService } from './halts.service';
import { toHold, toOrder, toPosition, toTradeQuote, WORKING_STATUSES } from './mappers';

export interface Placement {
  order: Order;
  replayed: boolean;
}

const FILTERS: Record<OrdersQuery['filter'], Prisma.OrderWhereInput> = {
  open: { status: { in: [...WORKING_STATUSES] } },
  filled: { status: 'filled' },
  all: {},
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly queue: ExecutionQueue,
    private readonly market: MarketService,
    private readonly config: TradingConfigService,
    private readonly halts: HaltsService,
    private readonly execution: ExecutionService,
  ) {}

  place(
    account: AccountRow,
    idempotencyKey: string,
    requestHash: string,
    request: PlaceOrderRequest,
    receivedAt: number,
  ): Promise<Placement> {
    return this.queue.run(async () => {
      const previous = await this.prisma.order.findUnique({
        where: { accountId_idempotencyKey: { accountId: account.id, idempotencyKey } },
        include: { fills: true },
      });
      if (previous) {
        if (previous.requestHash !== requestHash) {
          throw new UnprocessableEntityException({
            code: 'IDEMPOTENCY_MISMATCH',
            message: 'This Idempotency-Key was already used for a different order',
          });
        }
        return { order: toOrder(previous), replayed: true };
      }

      const quote = this.quoteFor(request.symbol);
      const now = this.clock.now();
      const draft = toDraft(request);
      const ctx = await this.context(account, request.symbol, quote, now);
      const [rejection] = validateOrder(draft, ctx);
      const estimate = estimateOrder(draft, ctx);
      const base = {
        accountId: account.id,
        epoch: account.epoch,
        symbol: request.symbol,
        side: request.side,
        type: request.type,
        tif: request.tif,
        qtyMicros: orderQty(draft, estimate),
        amountCents: request.size.kind === 'amount' ? BigInt(request.size.cents) : null,
        sellAll: request.size.kind === 'all',
        limitTicks: optionalBig(request.limitTicks),
        stopTicks: optionalBig(request.stopTicks),
        quotedTicks: BigInt(request.quotedTicks),
        idempotencyKey,
        requestHash,
        latencyMs: Math.max(0, Math.round(performance.now() - receivedAt)),
        createdAt: new Date(now),
        updatedAt: new Date(now),
      };

      // A rule the order breaks is part of its record, not an HTTP error: it's stored as rejected.
      if (rejection) {
        const row = await this.prisma.order.create({
          data: {
            ...base,
            status: 'rejected',
            rejection: JSON.stringify(rejection),
            closedAt: new Date(now),
          },
          include: { fills: true },
        });
        return { order: await this.execution.publish(row), replayed: false };
      }

      const holdPrice = estimate.holdPriceTicks;
      const row = await this.prisma.order.create({
        data: {
          ...base,
          status: estimate.queued ? 'queued' : 'open',
          heldCents: BigInt(estimate.holdCents),
          heldMicros: BigInt(estimate.holdMicros),
          holdPriceTicks: holdPrice === null ? null : BigInt(holdPrice),
          expiresAt:
            request.type === 'market' && !estimate.queued
              ? null
              : new Date(orderExpiry(request.tif, now, this.config.get().sessionMode)),
        },
        include: { fills: true },
      });
      await this.execution.publish(row);
      if (estimate.executesNow) await this.execution.work(row, ctx.quote);
      return { order: toOrder(await this.read(row.id)), replayed: false };
    });
  }

  async list(account: AccountRow, query: OrdersQuery): Promise<OrdersResponse> {
    const rows = await this.prisma.order.findMany({
      where: {
        accountId: account.id,
        epoch: account.epoch,
        ...FILTERS[query.filter],
        ...(query.symbol && { symbol: query.symbol }),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor && { cursor: { id: query.cursor }, skip: 1 }),
      include: { fills: true },
    });
    const page = rows.slice(0, query.limit);
    return {
      items: page.map(toOrder),
      nextCursor: rows.length > query.limit ? (page.at(-1)?.id ?? null) : null,
    };
  }

  async get(account: AccountRow, id: string): Promise<Order> {
    return toOrder(await this.owned(account, id));
  }

  // Losing the race to a fill isn't an error: the answer says it already filled.
  cancel(account: AccountRow, id: string): Promise<CancelOrderResponse> {
    return this.queue.run(async () => {
      const row = await this.owned(account, id);
      const outcome = cancelOutcome(row.status as Order['status']);
      if (outcome !== 'canceled') return { outcome, order: toOrder(row) };
      const closed = await this.execution.close(row, 'canceled', { cancelReason: 'user' });
      return { outcome, order: await this.execution.publish(closed) };
    });
  }

  modify(account: AccountRow, id: string, patch: ModifyOrderRequest): Promise<Order> {
    return this.queue.run(async () => {
      const row = await this.owned(account, id);
      const changeable =
        (row.type === 'limit' || row.type === 'stop') &&
        (row.status === 'open' || row.status === 'partially_filled');
      if (!changeable) {
        throw new ConflictException('Only an open limit or stop order can be changed');
      }
      if (
        (patch.limitTicks !== undefined && row.type !== 'limit') ||
        (patch.stopTicks !== undefined && row.type !== 'stop')
      ) {
        throw new UnprocessableEntityException(`A ${row.type} order has no such price`);
      }
      const filled = Number(row.filledMicros);
      const qtyMicros = patch.qtyMicros ?? Number(row.qtyMicros);
      if (qtyMicros <= filled) {
        throw new UnprocessableEntityException(
          'The new quantity must be more than what has filled',
        );
      }

      const now = this.clock.now();
      const draft: OrderDraft = {
        side: row.side as OrderDraft['side'],
        type: row.type as OrderDraft['type'],
        tif: row.tif as OrderDraft['tif'],
        size: { kind: 'shares', micros: micros(qtyMicros - filled) },
        ...(row.type === 'limit' && {
          limitTicks: ticks(patch.limitTicks ?? Number(row.limitTicks)),
        }),
        ...(row.type === 'stop' && { stopTicks: ticks(patch.stopTicks ?? Number(row.stopTicks)) }),
      };
      const ctx = await this.context(account, row.symbol, this.quoteFor(row.symbol), now, row.id);
      const [issue] = validateOrder(draft, ctx);
      if (issue) {
        throw new UnprocessableEntityException({
          code: issue.code,
          message: `The change breaks a trading rule (${issue.code})`,
        });
      }
      const estimate = estimateOrder(draft, ctx);
      const holdPrice = estimate.holdPriceTicks;
      const updated = await this.prisma.order.update({
        where: { id: row.id },
        data: {
          qtyMicros: BigInt(qtyMicros),
          limitTicks: optionalBig(draft.limitTicks),
          stopTicks: optionalBig(draft.stopTicks),
          heldCents: BigInt(estimate.holdCents),
          heldMicros: BigInt(estimate.holdMicros),
          holdPriceTicks: holdPrice === null ? null : BigInt(holdPrice),
          expiresAt: new Date(orderExpiry(draft.tif, now, this.config.get().sessionMode)),
          updatedAt: new Date(now),
        },
        include: { fills: true },
      });
      await this.execution.publish(updated);
      if (estimate.executesNow) await this.execution.work(updated, ctx.quote);
      return toOrder(await this.read(row.id));
    });
  }

  private quoteFor(symbol: string): Quote {
    const found = this.market.find(symbol);
    if (!found) throw new NotFoundException(`Unknown symbol ${symbol}`);
    return found.quote;
  }

  // Everything validateOrder needs; `excludeOrderId` leaves an order's own holds out (modify).
  private async context(
    account: AccountRow,
    symbol: string,
    quote: Quote,
    now: number,
    excludeOrderId?: string,
  ): Promise<OrderContext> {
    const settings = this.config.get();
    const [working, positionRow] = await Promise.all([
      this.prisma.order.findMany({
        where: {
          accountId: account.id,
          status: { in: [...WORKING_STATUSES] },
          ...(excludeOrderId && { id: { not: excludeOrderId } }),
        },
      }),
      this.prisma.position.findUnique({
        where: { accountId_symbol: { accountId: account.id, symbol } },
      }),
    ]);
    const holds = working.map(toHold);
    return {
      quote: toTradeQuote(quote),
      session: marketSession(now, settings.sessionMode),
      rules: settings.rules,
      tradingEnabled: settings.tradingEnabled,
      marketPaused: this.market.isPaused(),
      halted: this.halts.isHalted(symbol),
      buyingPowerCents: buyingPowerCents(cents(Number(account.cashCents)), holds),
      sellableMicros: sellableMicros(positionRow ? toPosition(positionRow) : null, holds),
      now,
    };
  }

  private async owned(account: AccountRow, id: string) {
    const row = await this.prisma.order.findFirst({
      where: { id, accountId: account.id },
      include: { fills: true },
    });
    if (!row) throw new NotFoundException('Order not found');
    return row;
  }

  private async read(id: string) {
    return this.prisma.order.findUniqueOrThrow({ where: { id }, include: { fills: true } });
  }
}

function toDraft(request: PlaceOrderRequest): OrderDraft {
  return {
    side: request.side,
    type: request.type,
    tif: request.tif,
    size: toDomain<OrderSize>(request.size),
    ...(request.limitTicks !== undefined && { limitTicks: ticks(request.limitTicks) }),
    ...(request.stopTicks !== undefined && { stopTicks: ticks(request.stopTicks) }),
  };
}

const optionalBig = (value: number | undefined): bigint | null =>
  value === undefined ? null : BigInt(value);

// A dollar market order's share count is only known at the fill; every other order is in shares.
function orderQty(draft: OrderDraft, estimate: OrderEstimate): bigint | null {
  if (draft.size.kind === 'shares') return BigInt(draft.size.micros);
  if (draft.size.kind === 'amount' && draft.type === 'market') return null;
  return BigInt(estimate.qtyMicros);
}
