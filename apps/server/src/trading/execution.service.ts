import { Injectable } from '@nestjs/common';
import { type Order as OrderRow } from '@prisma/client';

import {
  type CancelReason,
  type NotificationPayload,
  type Order,
  type RejectionWire,
} from '@sarwa/contracts';
import {
  applyFill,
  bps,
  buyingPowerCents,
  cents,
  closeOrder,
  type FillResult,
  fillNotionalCents,
  fillQuantity,
  limitFillPrice,
  marketFillPrice,
  micros,
  type Micros,
  remainingMicros,
  shouldTriggerStop,
  type Side,
  ticks,
  type Ticks,
  type TradeQuote,
  type WorkingOrder,
} from '@sarwa/domain';

import { Clock } from '../common/clock';
import { EventBus } from '../common/events';
import { SlippageRandom } from '../common/random';
import { PrismaService, type Tx } from '../prisma.service';
import { TradingConfigService } from '../trading-config/trading-config.service';
import { AccountsService } from './accounts.service';
import {
  isWorking,
  type OrderWithFills,
  positionData,
  toOrder,
  toHold,
  toPosition,
  toWorkingOrder,
  WORKING_STATUSES,
  workingOrderData,
} from './mappers';
import { OrderBook } from './order-book';

type ClosedStatus = 'canceled' | 'expired' | 'rejected';

// Runs inside the execution queue only. Every fill is one transaction over the account, the
// position, the order and the fill row, computed by the domain's applyFill.
@Injectable()
export class ExecutionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly random: SlippageRandom,
    private readonly config: TradingConfigService,
    private readonly book: OrderBook,
    private readonly accounts: AccountsService,
    private readonly events: EventBus,
  ) {}

  // The caller has checked that the session is open, the market running and the symbol not halted.
  // Returns what filled, so the caller can share the quote's displayed size between orders.
  async work(row: OrderRow, quote: TradeQuote): Promise<Micros> {
    const side = row.side as Side;
    let order = row;
    if (order.type === 'stop' && order.triggeredAt === null) {
      if (!shouldTriggerStop(side, ticks(Number(order.stopTicks)), quote.lastTicks)) {
        return micros(0);
      }
      const now = new Date(this.clock.now());
      order = await this.prisma.order.update({
        where: { id: order.id },
        data: { triggeredAt: now, updatedAt: now },
      });
    }

    const slippageBps = bps(
      Math.floor(this.random.next() * (this.config.get().rules.maxSlippageBps + 1)),
    );
    const price =
      order.type === 'limit'
        ? limitFillPrice(side, ticks(Number(order.limitTicks)), quote, slippageBps)
        : marketFillPrice(side, quote, slippageBps);
    if (price === null) return micros(0);

    const displayed = side === 'buy' ? quote.askSizeMicros : quote.bidSizeMicros;
    const qty = fillQuantity(activate(toWorkingOrder(order)), price, displayed);
    return qty > 0 ? this.fill(order.id, qty, price) : micros(0);
  }

  async close(
    row: OrderRow,
    status: ClosedStatus,
    extra: { cancelReason?: CancelReason; rejection?: RejectionWire } = {},
    tx: Tx = this.prisma,
  ): Promise<OrderWithFills> {
    const now = new Date(this.clock.now());
    return tx.order.update({
      where: { id: row.id },
      data: {
        ...workingOrderData(closeOrder(toWorkingOrder(row), status)),
        cancelReason: extra.cancelReason ?? null,
        rejection: extra.rejection ? JSON.stringify(extra.rejection) : row.rejection,
        updatedAt: now,
        closedAt: now,
      },
      include: { fills: true },
    });
  }

  async publish(row: OrderWithFills, notice?: NotificationPayload['kind']): Promise<Order> {
    this.book.sync(row);
    const order = toOrder(row);
    this.events.publish({
      type: 'order.changed',
      account: await this.accounts.ref(row.accountId),
      order,
      latencyMs: row.latencyMs,
      ...(notice && { notice }),
    });
    return order;
  }

  private async fill(orderId: string, wantedMicros: Micros, priceTicks: Ticks): Promise<Micros> {
    const now = new Date(this.clock.now());
    const outcome = await this.prisma.$transaction(async (tx) => {
      const row = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
      if (!isWorking(row.status)) return null;
      const account = await tx.account.findUniqueOrThrow({ where: { id: row.accountId } });
      const positionRow = await tx.position.findUnique({
        where: { accountId_symbol: { accountId: row.accountId, symbol: row.symbol } },
      });
      const position = positionRow ? toPosition(positionRow) : null;
      const cashCents = cents(Number(account.cashCents));
      const working = activate(toWorkingOrder(row));
      // The quantity was sized outside the transaction; never fill past what is still open.
      const qtyMicros =
        working.qtyMicros === null
          ? wantedMicros
          : micros(Math.min(wantedMicros, remainingMicros(working)));
      if (qtyMicros <= 0) return null;

      // Holds keep a sell within the position; this only trips if shares left by another path.
      if (row.side === 'sell' && qtyMicros > (position?.qtyMicros ?? 0)) {
        const rejection: RejectionWire = {
          code: 'INSUFFICIENT_SHARES',
          field: 'size',
          sellableMicros: position?.qtyMicros ?? 0,
        };
        return { order: await this.close(row, 'rejected', { rejection }, tx), filled: micros(0) };
      }
      // A stop or a queued order can gap past its hold: it may only spend cash no other order holds.
      if (row.side === 'buy') {
        const others = await tx.order.findMany({
          where: {
            accountId: row.accountId,
            id: { not: row.id },
            side: 'buy',
            status: { in: [...WORKING_STATUSES] },
          },
        });
        const availableCents = buyingPowerCents(cashCents, others.map(toHold));
        const requiredCents = fillNotionalCents(working, { qtyMicros, priceTicks });
        if (requiredCents > availableCents) {
          const rejection: RejectionWire = {
            code: 'INSUFFICIENT_FUNDS',
            field: 'size',
            requiredCents,
            availableCents: Math.max(0, availableCents),
          };
          return { order: await this.close(row, 'rejected', { rejection }, tx), filled: micros(0) };
        }
      }
      const result: FillResult = applyFill(cashCents, position, working, row.symbol, {
        qtyMicros,
        priceTicks,
      });

      await tx.account.update({
        where: { id: row.accountId },
        data: { cashCents: BigInt(result.cashCents) },
      });
      const key = { accountId_symbol: { accountId: row.accountId, symbol: row.symbol } };
      if (result.position) {
        await tx.position.upsert({
          where: key,
          update: positionData(result.position),
          create: {
            accountId: row.accountId,
            symbol: row.symbol,
            ...positionData(result.position),
          },
        });
      } else {
        await tx.position.deleteMany({ where: { accountId: row.accountId, symbol: row.symbol } });
      }
      await tx.fill.create({
        data: {
          orderId: row.id,
          accountId: row.accountId,
          epoch: row.epoch,
          symbol: row.symbol,
          side: row.side,
          qtyMicros: BigInt(qtyMicros),
          priceTicks: BigInt(priceTicks),
          notionalCents: BigInt(result.notionalCents),
          realizedCents: BigInt(result.realizedCents),
          at: now,
        },
      });
      const order = await tx.order.update({
        where: { id: row.id },
        data: {
          ...workingOrderData(result.order),
          updatedAt: now,
          closedAt: result.order.status === 'filled' ? now : null,
        },
        include: { fills: true },
      });
      return { order, filled: qtyMicros };
    });
    if (!outcome) return micros(0);

    const notice =
      outcome.filled === 0
        ? 'order_rejected'
        : outcome.order.status === 'filled'
          ? 'order_filled'
          : 'order_partially_filled';
    await this.publish(outcome.order, notice);
    return outcome.filled;
  }
}

// A queued order becomes open the moment it can execute.
function activate(order: WorkingOrder): WorkingOrder {
  return order.status === 'queued' ? { ...order, status: 'open' } : order;
}
