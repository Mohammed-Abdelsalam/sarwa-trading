import {
  BPS_PER_UNIT,
  type Cents,
  divide,
  type Micros,
  notionalCents,
  scaleBps,
  sharesForCents,
  type Ticks,
} from './money';
import { type TradeQuote, quoteAgeMs } from './quote';
import { type ExecutionRules, POLICY } from './rules';
import { type MarketSession, type TimeInForce } from './session';

export const SIDES = ['buy', 'sell'] as const;
export type Side = (typeof SIDES)[number];

export const ORDER_TYPES = ['market', 'limit', 'stop'] as const;
export type OrderType = (typeof ORDER_TYPES)[number];

// "Sending…" is a client state before the server answers, not an order status.
export const ORDER_STATUSES = [
  'queued',
  'open',
  'partially_filled',
  'filled',
  'canceled',
  'rejected',
  'expired',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const TERMINAL_STATUSES: readonly OrderStatus[] = [
  'filled',
  'canceled',
  'rejected',
  'expired',
];

export function isTerminal(status: OrderStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

// Ordered by precedence: the first one that applies is the reason a blocked button shows.
export const REJECTION_CODES = [
  'TRADING_DISABLED',
  'MARKET_PAUSED',
  'SYMBOL_HALTED',
  'MARKET_CLOSED',
  'STALE_QUOTE',
  'INVALID_PRICE',
  'PRICE_COLLAR',
  'MIN_NOTIONAL',
  'MAX_NOTIONAL',
  'INSUFFICIENT_FUNDS',
  'INSUFFICIENT_SHARES',
] as const;
export type RejectionCode = (typeof REJECTION_CODES)[number];

export type Rejection =
  | { code: 'TRADING_DISABLED' | 'MARKET_PAUSED' | 'SYMBOL_HALTED' | 'MARKET_CLOSED' }
  | { code: 'STALE_QUOTE'; ageMs: number; maxAgeMs: number }
  | { code: 'INVALID_PRICE'; field: 'limit' | 'stop'; lastTicks: Ticks }
  | { code: 'PRICE_COLLAR'; field: 'limit' | 'stop'; minTicks: Ticks; maxTicks: Ticks }
  | { code: 'MIN_NOTIONAL'; field: 'size'; minCents: Cents }
  | { code: 'MAX_NOTIONAL'; field: 'size'; maxCents: Cents }
  | { code: 'INSUFFICIENT_FUNDS'; field: 'size'; requiredCents: Cents; availableCents: Cents }
  | { code: 'INSUFFICIENT_SHARES'; field: 'size'; sellableMicros: Micros };

// Amount ($) orders keep their notional; for limit and stop orders it becomes shares at that price.
export type OrderSize =
  { kind: 'amount'; cents: Cents } | { kind: 'shares'; micros: Micros } | { kind: 'all' };

export interface OrderDraft {
  side: Side;
  type: OrderType;
  tif: TimeInForce;
  size: OrderSize;
  limitTicks?: Ticks;
  stopTicks?: Ticks;
}

export interface OrderContext {
  quote: TradeQuote;
  session: MarketSession;
  rules: ExecutionRules;
  tradingEnabled: boolean;
  marketPaused: boolean;
  halted: boolean;
  buyingPowerCents: Cents;
  // Held shares minus those reserved by open sell orders.
  sellableMicros: Micros;
  now: number;
}

export interface OrderEstimate {
  // Ask for buys and bid for sells on market orders, the limit or stop price otherwise.
  priceTicks: Ticks;
  qtyMicros: Micros;
  notionalCents: Cents;
  feesCents: Cents;
  holdCents: Cents;
  holdMicros: Micros;
  // Fills (or may fill) the moment it is accepted: a market order in session, or a marketable limit.
  executesNow: boolean;
  queued: boolean;
}

export function isMarketable(side: Side, limitTicks: Ticks, quote: TradeQuote): boolean {
  return side === 'buy' ? quote.askTicks <= limitTicks : quote.bidTicks >= limitTicks;
}

function referencePrice(draft: OrderDraft, quote: TradeQuote): Ticks {
  if (draft.type === 'limit' && draft.limitTicks !== undefined) return draft.limitTicks;
  if (draft.type === 'stop' && draft.stopTicks !== undefined) return draft.stopTicks;
  return draft.side === 'buy' ? quote.askTicks : quote.bidTicks;
}

export function estimateOrder(draft: OrderDraft, ctx: OrderContext): OrderEstimate {
  const { quote, session } = ctx;
  const priceTicks = referencePrice(draft, quote);
  const executesNow =
    session.isOpen &&
    (draft.type === 'market' ||
      (draft.type === 'limit' &&
        draft.limitTicks !== undefined &&
        isMarketable(draft.side, draft.limitTicks, quote)));
  const queued = draft.type === 'market' && !session.isOpen;

  const qtyMicros =
    draft.size.kind === 'shares'
      ? draft.size.micros
      : draft.size.kind === 'all'
        ? ctx.sellableMicros
        : priceTicks > 0
          ? sharesForCents(draft.size.cents, priceTicks)
          : 0;
  const notional =
    draft.size.kind === 'amount' && draft.type === 'market'
      ? draft.size.cents
      : notionalCents(qtyMicros, priceTicks, draft.side === 'buy' ? 'up' : 'down');

  return {
    priceTicks,
    qtyMicros,
    notionalCents: notional,
    feesCents: 0,
    holdCents: draft.side === 'buy' ? buyHoldCents(draft, priceTicks, qtyMicros, ctx) : 0,
    holdMicros: draft.side === 'sell' ? sellHoldMicros(draft, priceTicks, qtyMicros, ctx) : 0,
    executesNow,
    queued,
  };
}

// Cash a buy reserves. A dollar amount reserves exactly that; shares reserve enough for the worst
// fill: slippage while open, the closed-market buffer (at least as large) for queued or stop orders.
function buyHoldCents(draft: OrderDraft, priceTicks: Ticks, qty: Micros, ctx: OrderContext): Cents {
  if (draft.type === 'market' && draft.size.kind === 'amount') return draft.size.cents;
  if (draft.type === 'limit') return notionalCents(qty, priceTicks, 'up');
  const { maxSlippageBps, closedMarketBufferBps } = ctx.rules;
  const buffer =
    draft.type === 'market' && ctx.session.isOpen
      ? maxSlippageBps
      : Math.max(maxSlippageBps, closedMarketBufferBps);
  return notionalCents(qty, scaleBps(priceTicks, buffer, 'up'), 'up');
}

// A market sell for a dollar amount may need more shares if the bid slips before the fill.
function sellHoldMicros(
  draft: OrderDraft,
  priceTicks: Ticks,
  qty: Micros,
  ctx: OrderContext,
): Micros {
  if (draft.type !== 'market' || draft.size.kind !== 'amount') return qty;
  const worstBid = scaleBps(priceTicks, -ctx.rules.maxSlippageBps, 'down');
  return Math.min(ctx.sellableMicros, sharesForCents(draft.size.cents, worstBid, 'up'));
}

export function collarRange(lastTicks: Ticks, rules: Pick<ExecutionRules, 'collarBps'>) {
  return {
    minTicks: scaleBps(lastTicks, -rules.collarBps, 'up'),
    maxTicks: scaleBps(lastTicks, rules.collarBps, 'down'),
  };
}

// Every reason the order can't be placed, in precedence order. The server rejects with the first;
// the ticket shows the first on its button and each field's own error inline.
export function validateOrder(draft: OrderDraft, ctx: OrderContext): Rejection[] {
  const { quote, rules } = ctx;
  const estimate = estimateOrder(draft, ctx);
  const issues: Rejection[] = [];

  if (!ctx.tradingEnabled) issues.push({ code: 'TRADING_DISABLED' });
  if (ctx.marketPaused) issues.push({ code: 'MARKET_PAUSED' });
  if (ctx.halted) issues.push({ code: 'SYMBOL_HALTED' });
  if (estimate.queued && !rules.queueWhenClosed) issues.push({ code: 'MARKET_CLOSED' });
  // Staleness only matters for an order that would execute on this quote right now.
  const ageMs = quoteAgeMs(quote, ctx.now);
  if (estimate.executesNow && ageMs > rules.staleQuoteMs) {
    issues.push({ code: 'STALE_QUOTE', ageMs, maxAgeMs: rules.staleQuoteMs });
  }

  const priceField = draft.type === 'limit' ? 'limit' : draft.type === 'stop' ? 'stop' : null;
  if (priceField) {
    const price = estimate.priceTicks;
    // A stop on the wrong side of the market would trigger at once: a market order in disguise.
    const wrongSideStop =
      priceField === 'stop' &&
      (draft.side === 'buy' ? price <= quote.lastTicks : price >= quote.lastTicks);
    const collar = collarRange(quote.lastTicks, rules);
    if (price <= 0 || wrongSideStop) {
      issues.push({ code: 'INVALID_PRICE', field: priceField, lastTicks: quote.lastTicks });
    } else if (price < collar.minTicks || price > collar.maxTicks) {
      issues.push({ code: 'PRICE_COLLAR', field: priceField, ...collar });
    }
  }

  if (estimate.notionalCents < rules.minNotionalCents) {
    issues.push({ code: 'MIN_NOTIONAL', field: 'size', minCents: rules.minNotionalCents });
  }
  if (estimate.notionalCents > rules.maxNotionalCents) {
    issues.push({ code: 'MAX_NOTIONAL', field: 'size', maxCents: rules.maxNotionalCents });
  }
  if (draft.side === 'buy' && estimate.holdCents > ctx.buyingPowerCents) {
    issues.push({
      code: 'INSUFFICIENT_FUNDS',
      field: 'size',
      requiredCents: estimate.holdCents,
      availableCents: ctx.buyingPowerCents,
    });
  }
  if (
    draft.side === 'sell' &&
    (estimate.qtyMicros > ctx.sellableMicros || ctx.sellableMicros === 0)
  ) {
    issues.push({ code: 'INSUFFICIENT_SHARES', field: 'size', sellableMicros: ctx.sellableMicros });
  }
  return issues;
}

// The review asks for an extra confirmation when one order is a large slice of the account.
export function needsLargeOrderConfirm(notional: Cents, equity: Cents): boolean {
  return equity > 0 && notional * BPS_PER_UNIT > equity * POLICY.largeOrderEquityBps;
}

// Signed slippage of a fill against the quoted price, in bps (positive = worse for the trader).
export function slippageBps(side: Side, quotedTicks: Ticks, fillTicks: Ticks): number {
  const diff = side === 'buy' ? fillTicks - quotedTicks : quotedTicks - fillTicks;
  return divide(BigInt(diff) * BigInt(BPS_PER_UNIT), BigInt(quotedTicks), 'nearest');
}
