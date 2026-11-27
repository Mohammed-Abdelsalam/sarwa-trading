import {
  type HoldWire,
  type Order,
  type PortfolioPosition,
  type PortfolioResponse,
  type Quote,
} from '@sarwa/contracts';
import {
  averageCostTicks,
  averageFillTicks,
  bps,
  type Bps,
  cents,
  type Cents,
  dollarsToTicks,
  type Hold,
  micros,
  negate,
  parseCents,
  type Position,
  ratioBps,
  sharesToMicros,
  type PortfolioSummary,
  slippageBps,
  summarizePortfolio,
  ticks,
  type Ticks,
  ticksToCents,
  type TradeQuote,
} from '@sarwa/domain';

// Quotes travel in dollars and shares; the domain rules work in integer ticks and micros.
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

// The books travel as plain integers; the domain takes them in their units.
export function toPosition(
  position: Pick<PortfolioPosition, 'symbol' | 'qtyMicros' | 'costBasisCents'>,
): Position {
  return {
    symbol: position.symbol,
    qtyMicros: micros(position.qtyMicros),
    costBasisCents: cents(position.costBasisCents),
  };
}

export function toHold(hold: HoldWire): Hold {
  return {
    side: hold.side,
    symbol: hold.symbol,
    heldCents: cents(hold.heldCents),
    heldMicros: micros(hold.heldMicros),
  };
}

// A typed % move, signed: two decimals have the cents scale, so "-5.25" is −525 bps (a down move).
export function parseMoveBps(text: string): Bps | null {
  const [, sign = '', digits = ''] = /^\s*([-+−]?)(.*)$/.exec(text) ?? [];
  const parsed = parseCents(digits);
  if (parsed === null || parsed === 0) return null;
  const move = bps(parsed);
  return sign === '' || sign === '+' ? move : negate(move);
}

// The spread as a share of the mid price, the same on every screen.
export function spreadBps(quote: Pick<TradeQuote, 'bidTicks' | 'askTicks'>): Bps {
  return ratioBps(2 * (quote.askTicks - quote.bidTicks), quote.askTicks + quote.bidTicks);
}

export interface OrderFill {
  avgFillTicks: Ticks | null;
  slippageBps: Bps | null;
  // Per share, signed like slippageBps (positive = worse for the trader).
  slippageCents: Cents | null;
}

export function orderFill(order: Order): OrderFill {
  if (order.filledMicros === 0)
    return { avgFillTicks: null, slippageBps: null, slippageCents: null };
  const avg =
    order.avgFillTicks === null
      ? averageFillTicks({
          filledMicros: micros(order.filledMicros),
          filledNotionalCents: cents(order.filledNotionalCents),
        })
      : ticks(order.avgFillTicks);
  const quoted = ticks(order.quotedTicks);
  const worse = order.side === 'buy' ? avg - quoted : quoted - avg;
  return {
    avgFillTicks: avg,
    slippageBps: slippageBps(order.side, quoted, avg),
    slippageCents: ticksToCents(ticks(worse), 'nearest'),
  };
}

// Raw books priced with the freshest quote per symbol. A position with no quote at all is valued at
// its average cost, so the totals still render (with zero P&L for it) instead of disappearing.
export function livePortfolio(
  books: PortfolioResponse,
  quoteFor: (symbol: string) => Quote | undefined,
): PortfolioSummary {
  const { account, equityAtLastCloseCents } = books;
  return summarizePortfolio({
    cashCents: cents(account.cashCents),
    startingCashCents: cents(account.startingCashCents),
    holds: books.holds.map(toHold),
    realizedYtdCents: cents(books.realizedYtdCents),
    equityAtLastCloseCents: equityAtLastCloseCents === null ? null : cents(equityAtLastCloseCents),
    positions: books.positions.map((wire) => {
      const quote = quoteFor(wire.symbol);
      const position = toPosition(wire);
      const fallback = averageCostTicks(position);
      return {
        position,
        sector: wire.sector,
        lastTicks: quote ? dollarsToTicks(quote.price) : fallback,
        prevCloseTicks: quote ? dollarsToTicks(quote.prevClose) : fallback,
        today: wire.today
          ? {
              qtyAtOpenMicros: micros(wire.today.qtyAtOpenMicros),
              boughtCents: cents(wire.today.boughtCents),
              soldCents: cents(wire.today.soldCents),
            }
          : undefined,
      };
    }),
  });
}
