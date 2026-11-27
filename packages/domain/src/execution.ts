import {
  type Bps,
  cents,
  type Cents,
  divide,
  exactNotional,
  exactToCents,
  micros,
  type Micros,
  negate,
  notionalCents,
  scaleBps,
  sharesForCents,
  ticks,
  type Ticks,
} from './money';
import { isMarketable, type OrderStatus, type OrderType, type Side } from './orders';
import { averageCostTicks, type Position } from './portfolio';
import { type TradeQuote } from './quote';
import { type CircuitBreakerRules } from './rules';

// The live part of an order the engine works on.
export interface WorkingOrder {
  side: Side;
  type: OrderType;
  status: OrderStatus;
  // Null for a market order sized in dollars: its share count is only known at the fill.
  qtyMicros: Micros | null;
  amountCents: Cents | null;
  limitTicks: Ticks | null;
  stopTicks: Ticks | null;
  filledMicros: Micros;
  filledNotionalCents: Cents;
  // Exact running value of all fills (see exactNotional): cash moves by the change in its rounded
  // total, so partial fills can never spend more than the hold.
  filledExactNotional: bigint;
  heldCents: Cents;
  heldMicros: Micros;
  // The price a share-sized buy's cash hold is computed at, so each partial fill releases exactly
  // its share of it and the rest is released on cancel.
  holdPriceTicks: Ticks | null;
  // What fills plus the hold may ever take; reset when the order is changed. Null on older orders.
  holdBudgetCents: Cents | null;
}

export function marketFillPrice(side: Side, quote: TradeQuote, slippageBps: Bps): Ticks {
  return side === 'buy'
    ? scaleBps(quote.askTicks, slippageBps, 'up')
    : scaleBps(quote.bidTicks, negate(slippageBps), 'down');
}

// A limit fills at its price or better; null while the market hasn't reached it.
export function limitFillPrice(
  side: Side,
  limitTicks: Ticks,
  quote: TradeQuote,
  slippageBps: Bps,
): Ticks | null {
  if (!isMarketable(side, limitTicks, quote)) return null;
  const market = marketFillPrice(side, quote, slippageBps);
  return ticks(side === 'buy' ? Math.min(limitTicks, market) : Math.max(limitTicks, market));
}

// Stops trigger on the last trade (the only real print) and then fill as market orders.
export function shouldTriggerStop(side: Side, stopTicks: Ticks, lastTicks: Ticks): boolean {
  return side === 'buy' ? lastTicks >= stopTicks : lastTicks <= stopTicks;
}

export function remainingMicros(order: WorkingOrder): Micros {
  return micros(order.qtyMicros === null ? 0 : order.qtyMicros - order.filledMicros);
}

// How much fills now. Dollar orders fill whole at the fill price; limit orders fill up to the size
// shown on the quote, which is how they fill partially; market orders take everything.
export function fillQuantity(
  order: WorkingOrder,
  priceTicks: Ticks,
  displayedMicros: Micros,
): Micros {
  if (order.amountCents !== null && order.qtyMicros === null) {
    return order.side === 'buy'
      ? sharesForCents(order.amountCents, priceTicks, 'down')
      : micros(Math.min(order.heldMicros, sharesForCents(order.amountCents, priceTicks, 'up')));
  }
  const remaining = remainingMicros(order);
  return order.type === 'limit' ? micros(Math.min(remaining, displayedMicros)) : remaining;
}

export interface FillResult {
  cashCents: Cents;
  position: Position | null;
  order: WorkingOrder;
  notionalCents: Cents;
  // Only sells realize P&L: proceeds minus the share of cost basis that left the position.
  realizedCents: Cents;
}

export class IllegalFillError extends Error {}

interface FillInput {
  qtyMicros: Micros;
  priceTicks: Ticks;
}

// What one fill moves cash by: the change in the rounded running total of the order's fills.
export function fillNotionalCents(
  order: Pick<WorkingOrder, 'side' | 'filledExactNotional' | 'filledNotionalCents'>,
  fill: FillInput,
): Cents {
  const exact = order.filledExactNotional + exactNotional(fill.qtyMicros, fill.priceTicks);
  return cents(
    exactToCents(exact, order.side === 'buy' ? 'up' : 'down') - order.filledNotionalCents,
  );
}

export function applyFill(
  cashCents: Cents,
  position: Position | null,
  order: WorkingOrder,
  symbol: string,
  fill: FillInput,
): FillResult {
  const { qtyMicros: qty, priceTicks: price } = fill;
  if (qty <= 0) throw new IllegalFillError('A fill needs a positive quantity');
  if (order.status !== 'open' && order.status !== 'partially_filled') {
    throw new IllegalFillError(`Can't fill an order that is ${order.status}`);
  }
  if (order.qtyMicros !== null && qty > remainingMicros(order)) {
    throw new IllegalFillError('Fill exceeds the remaining quantity');
  }
  if (order.side === 'buy' && order.qtyMicros !== null && order.holdPriceTicks === null) {
    throw new IllegalFillError('A share-sized buy needs the price its cash hold was taken at');
  }
  const filledExact = order.filledExactNotional + exactNotional(qty, price);
  const notional = fillNotionalCents(order, fill);
  const filledNotional = cents(order.filledNotionalCents + notional);

  let nextCash: Cents;
  let nextPosition: Position | null;
  let realized = cents(0);

  if (order.side === 'buy') {
    nextCash = cents(cashCents - notional);
    if (nextCash < 0) throw new IllegalFillError('A buy can never take cash below 0');
    nextPosition = {
      symbol,
      qtyMicros: micros((position?.qtyMicros ?? 0) + qty),
      costBasisCents: cents((position?.costBasisCents ?? 0) + notional),
    };
  } else {
    if (!position || qty > position.qtyMicros)
      throw new IllegalFillError('Not enough shares to sell');
    // Closing the whole position removes all remaining basis, so nothing is left behind by rounding.
    const basisRemoved =
      qty === position.qtyMicros
        ? position.costBasisCents
        : divide(
            BigInt(position.costBasisCents) * BigInt(qty),
            BigInt(position.qtyMicros),
            'nearest',
          );
    realized = cents(notional - basisRemoved);
    nextCash = cents(cashCents + notional);
    nextPosition =
      qty === position.qtyMicros
        ? null
        : {
            symbol,
            qtyMicros: micros(position.qtyMicros - qty),
            costBasisCents: cents(position.costBasisCents - basisRemoved),
          };
  }

  const filledMicros = micros(order.filledMicros + qty);
  const remaining = micros(order.qtyMicros === null ? 0 : order.qtyMicros - filledMicros);
  const done = remaining === 0;
  return {
    cashCents: nextCash,
    position: nextPosition,
    notionalCents: notional,
    realizedCents: realized,
    order: {
      ...order,
      qtyMicros: order.qtyMicros ?? qty,
      status: done ? 'filled' : 'partially_filled',
      filledMicros,
      filledNotionalCents: filledNotional,
      filledExactNotional: filledExact,
      heldCents:
        order.side === 'buy' && order.holdPriceTicks !== null && !done
          ? remainingBuyHold(
              order.holdBudgetCents ??
                notionalCents(micros(filledMicros + remaining), order.holdPriceTicks, 'up'),
              order.holdPriceTicks,
              remaining,
              filledNotional,
            )
          : cents(0),
      heldMicros: order.side === 'sell' ? remaining : micros(0),
    },
  };
}

// What the unfilled shares still need, but never more than the budget minus what was already spent:
// debited + held stays within the budget, so buying power can't dip below 0.
function remainingBuyHold(
  budget: Cents,
  holdPrice: Ticks,
  remaining: Micros,
  debited: Cents,
): Cents {
  return cents(Math.max(0, Math.min(notionalCents(remaining, holdPrice, 'up'), budget - debited)));
}

// Average fill price so far, for the order detail and the filled screen.
export function averageFillTicks(
  order: Pick<WorkingOrder, 'filledMicros' | 'filledNotionalCents'>,
): Ticks {
  return averageCostTicks({
    qtyMicros: order.filledMicros,
    costBasisCents: order.filledNotionalCents,
  });
}

export type CancelOutcome = 'canceled' | 'already_filled' | 'already_closed';

// A cancel that loses the race to a fill is not an error: the user is told it already filled.
export function cancelOutcome(status: OrderStatus): CancelOutcome {
  if (status === 'filled') return 'already_filled';
  if (status === 'canceled' || status === 'rejected' || status === 'expired')
    return 'already_closed';
  return 'canceled';
}

// Ends a working order (cancel, expiry, reset): it keeps its fills and releases every hold.
export function closeOrder(
  order: WorkingOrder,
  status: 'canceled' | 'expired' | 'rejected',
): WorkingOrder {
  return { ...order, status, heldCents: cents(0), heldMicros: micros(0) };
}

export interface PricePoint {
  t: number;
  ticks: Ticks;
}

export function trimWindow(
  points: readonly PricePoint[],
  now: number,
  windowMs: number,
): PricePoint[] {
  return points.filter((point) => now - point.t <= windowMs);
}

// Trips when the price has moved by the threshold from the low or the high of the window, so a fast
// round trip (down 10%, back up) is caught too.
export function breakerTrips(
  window: readonly PricePoint[],
  lastTicks: Ticks,
  rules: Pick<CircuitBreakerRules, 'enabled' | 'moveBps'>,
): boolean {
  if (!rules.enabled || window.length === 0) return false;
  const prices = window.map((point) => point.ticks);
  const low = ticks(Math.min(...prices));
  const high = ticks(Math.max(...prices));
  return (
    lastTicks >= scaleBps(low, rules.moveBps, 'up') ||
    lastTicks <= scaleBps(high, negate(rules.moveBps), 'down')
  );
}
