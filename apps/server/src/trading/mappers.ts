import {
  type Account as AccountRow,
  type Alert as AlertRow,
  type Fill as FillRow,
  type Halt as HaltRow,
  type Notification as NotificationRow,
  type Order as OrderRow,
  type Position as PositionRow,
} from '@prisma/client';

import {
  type Account,
  type Alert,
  type CancelReason,
  type Fill,
  type Halt,
  type HoldWire,
  type Notification,
  type NotificationPayload,
  type Order,
  type Quote,
  type RejectionWire,
} from '@sarwa/contracts';
import {
  type AlertCondition,
  type AlertRepeat,
  averageFillTicks,
  cents,
  dollarsToTicks,
  type Hold,
  micros,
  type OrderStatus,
  type OrderType,
  type Position,
  POLICY,
  sharesToMicros,
  type Side,
  ticks,
  type TimeInForce,
  type TradeQuote,
  type WorkingOrder,
} from '@sarwa/domain';

// The one place BigInt columns become numbers: every stored amount is a safe integer by construction.
const num = (value: bigint): number => Number(value);
const numOrNull = (value: bigint | null): number | null => (value === null ? null : Number(value));
// A stored amount read back in its unit: cents, ticks or micros.
const unitOrNull = <Unit>(value: bigint | null, unit: (amount: number) => Unit): Unit | null =>
  value === null ? null : unit(Number(value));
const big = (value: number): bigint => BigInt(value);
const bigOrNull = (value: number | null): bigint | null => (value === null ? null : BigInt(value));
const time = (value: Date | null): number | null => value?.getTime() ?? null;

export const WORKING_STATUSES = [
  'queued',
  'open',
  'partially_filled',
] as const satisfies readonly OrderStatus[];

export type OrderWithFills = OrderRow & { fills: FillRow[] };

export function isWorking(status: string): boolean {
  return (WORKING_STATUSES as readonly string[]).includes(status);
}

export function toFill(row: FillRow): Fill {
  return {
    id: row.id,
    qtyMicros: num(row.qtyMicros),
    priceTicks: num(row.priceTicks),
    notionalCents: num(row.notionalCents),
    realizedCents: num(row.realizedCents),
    at: row.at.getTime(),
  };
}

export function toOrder(row: OrderWithFills): Order {
  const filledMicros = num(row.filledMicros);
  const filledNotionalCents = num(row.filledNotionalCents);
  return {
    id: row.id,
    symbol: row.symbol,
    side: row.side as Side,
    type: row.type as OrderType,
    tif: row.tif as TimeInForce,
    status: row.status as OrderStatus,
    qtyMicros: numOrNull(row.qtyMicros),
    amountCents: numOrNull(row.amountCents),
    sellAll: row.sellAll,
    limitTicks: numOrNull(row.limitTicks),
    stopTicks: numOrNull(row.stopTicks),
    quotedTicks: num(row.quotedTicks),
    filledMicros,
    filledNotionalCents,
    avgFillTicks:
      filledMicros > 0
        ? averageFillTicks({
            filledMicros: micros(filledMicros),
            filledNotionalCents: cents(filledNotionalCents),
          })
        : null,
    heldCents: num(row.heldCents),
    heldMicros: num(row.heldMicros),
    rejection: row.rejection ? (JSON.parse(row.rejection) as RejectionWire) : null,
    cancelReason: row.cancelReason as CancelReason | null,
    fills: [...row.fills].sort((a, b) => a.at.getTime() - b.at.getTime()).map(toFill),
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
    triggeredAt: time(row.triggeredAt),
    expiresAt: time(row.expiresAt),
    closedAt: time(row.closedAt),
  };
}

export function toWorkingOrder(row: OrderRow): WorkingOrder {
  return {
    side: row.side as Side,
    type: row.type as OrderType,
    status: row.status as OrderStatus,
    qtyMicros: unitOrNull(row.qtyMicros, micros),
    amountCents: unitOrNull(row.amountCents, cents),
    limitTicks: unitOrNull(row.limitTicks, ticks),
    stopTicks: unitOrNull(row.stopTicks, ticks),
    filledMicros: micros(num(row.filledMicros)),
    filledNotionalCents: cents(num(row.filledNotionalCents)),
    filledExactNotional: BigInt(row.filledExactNotional),
    heldCents: cents(num(row.heldCents)),
    heldMicros: micros(num(row.heldMicros)),
    holdPriceTicks: unitOrNull(row.holdPriceTicks, ticks),
  };
}

export function workingOrderData(order: WorkingOrder) {
  return {
    status: order.status,
    qtyMicros: bigOrNull(order.qtyMicros),
    filledMicros: big(order.filledMicros),
    filledNotionalCents: big(order.filledNotionalCents),
    filledExactNotional: order.filledExactNotional.toString(),
    heldCents: big(order.heldCents),
    heldMicros: big(order.heldMicros),
  };
}

// Both the wire hold and the domain one, so the same rows answer the client and the rules.
export function toHold(row: OrderRow): HoldWire & Hold {
  return {
    orderId: row.id,
    side: row.side as Side,
    symbol: row.symbol,
    heldCents: cents(num(row.heldCents)),
    heldMicros: micros(num(row.heldMicros)),
  };
}

export function toPosition(row: PositionRow): Position {
  return {
    symbol: row.symbol,
    qtyMicros: micros(num(row.qtyMicros)),
    costBasisCents: cents(num(row.costBasisCents)),
  };
}

export function positionData(position: Position) {
  return { qtyMicros: big(position.qtyMicros), costBasisCents: big(position.costBasisCents) };
}

export function toAccount(row: AccountRow): Account {
  return {
    id: row.id,
    handle: row.handle,
    cashCents: num(row.cashCents),
    startingCashCents: POLICY.startingCashCents,
    createdAt: row.createdAt.getTime(),
    resetAt: time(row.resetAt),
  };
}

export function toTradeQuote(quote: Quote): TradeQuote {
  return {
    lastTicks: dollarsToTicks(quote.price),
    bidTicks: dollarsToTicks(quote.bid),
    askTicks: dollarsToTicks(quote.ask),
    prevCloseTicks: dollarsToTicks(quote.prevClose),
    bidSizeMicros: sharesToMicros(quote.bidSize),
    askSizeMicros: sharesToMicros(quote.askSize),
    ts: quote.ts,
  };
}

export function toAlert(row: AlertRow): Alert {
  return {
    id: row.id,
    symbol: row.symbol,
    condition: row.condition as AlertCondition,
    thresholdTicks: numOrNull(row.thresholdTicks),
    thresholdBps: row.thresholdBps,
    repeat: row.repeat as AlertRepeat,
    enabled: row.enabled,
    armed: row.armed,
    lastFiredAt: time(row.lastFiredAt),
    createdAt: row.createdAt.getTime(),
  };
}

export function toNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    payload: JSON.parse(row.payload) as NotificationPayload,
    readAt: time(row.readAt),
    createdAt: row.createdAt.getTime(),
  };
}

export function toHalt(row: HaltRow): Halt {
  return {
    symbol: row.symbol,
    source: row.source === 'admin' ? 'admin' : 'circuit_breaker',
    message: row.message,
    since: row.since.getTime(),
    resumesAt: time(row.resumesAt),
  };
}
