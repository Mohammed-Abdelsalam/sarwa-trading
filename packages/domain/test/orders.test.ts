import { bps, cents, micros, ticks } from '../src/money';
import {
  CANCEL_REASONS,
  collarRange,
  estimateOrder,
  isMarketable,
  isTerminal,
  needsLargeOrderConfirm,
  orderRealizedCents,
  ORDER_STATUSES,
  ORDER_TYPES,
  type OrderContext,
  type OrderDraft,
  REJECTION_CODES,
  remainingAmountCents,
  remainingQtyMicros,
  SIDES,
  slippageBps,
  TERMINAL_STATUSES,
  validateOrder,
} from '../src/orders';
import { spreadAround, type TradeQuote } from '../src/quote';
import { DEFAULT_EXECUTION_RULES } from '../src/rules';
import { type MarketSession } from '../src/session';

const NOW = 1_000_000;
const SHARE = 1_000_000;

// $100.00 last, 2 bps spread → bid $99.99, ask $100.01.
function quote(lastTicks = ticks(1_000_000), overrides: Partial<TradeQuote> = {}): TradeQuote {
  return {
    lastTicks,
    ...spreadAround(lastTicks, DEFAULT_EXECUTION_RULES.spreadBps),
    prevCloseTicks: lastTicks,
    bidSizeMicros: micros(100 * SHARE),
    askSizeMicros: micros(100 * SHARE),
    ts: NOW,
    ...overrides,
  };
}

const OPEN: MarketSession = {
  phase: 'regular',
  isOpen: true,
  opensAt: 0,
  closesAt: 0,
  earlyClose: false,
};
const CLOSED: MarketSession = { ...OPEN, phase: 'closed', isOpen: false };

function ctx(overrides: Partial<OrderContext> = {}): OrderContext {
  return {
    quote: quote(),
    session: OPEN,
    rules: DEFAULT_EXECUTION_RULES,
    tradingEnabled: true,
    marketPaused: false,
    halted: false,
    buyingPowerCents: cents(10_000_000),
    sellableMicros: micros(0),
    now: NOW,
    ...overrides,
  };
}

const marketBuy = (qty: number): OrderDraft => ({
  side: 'buy',
  type: 'market',
  tif: 'day',
  size: { kind: 'shares', micros: micros(qty) },
});

const codes = (draft: OrderDraft, context: OrderContext) =>
  validateOrder(draft, context).map((issue) => issue.code);

describe('estimateOrder', () => {
  it('prices a market buy at the ask and holds for max slippage while open', () => {
    const estimate = estimateOrder(marketBuy(10 * SHARE), ctx());

    expect(estimate).toEqual({
      priceTicks: 1_000_100,
      qtyMicros: 10 * SHARE,
      notionalCents: 100_010,
      feesCents: 0,
      // 10 × $100.01 × 1.0005 = $1,000.601 → rounded up.
      holdCents: 100_061,
      holdMicros: 0,
      // $100.01 × 1.0005 rounded up to the tick: each fill releases its share of the hold at this price.
      holdPriceTicks: 1_000_601,
      executesNow: true,
      queued: false,
    });
  });

  it('queues a market buy while closed and holds for the closed-market buffer', () => {
    const estimate = estimateOrder(marketBuy(10 * SHARE), ctx({ session: CLOSED }));

    // 10 × $100.01 × 1.05.
    expect(estimate.holdCents).toBe(105_011);
    expect(estimate.queued).toBe(true);
    expect(estimate.executesNow).toBe(false);
  });

  it('holds a stop buy at the stop price plus the closed-market buffer even while open', () => {
    const draft: OrderDraft = {
      ...marketBuy(10 * SHARE),
      type: 'stop',
      stopTicks: ticks(1_050_000),
    };

    const estimate = estimateOrder(draft, ctx());

    expect(estimate.priceTicks).toBe(1_050_000);
    expect(estimate.holdCents).toBe(110_250);
    expect(estimate.executesNow).toBe(false);
    expect(estimate.queued).toBe(false);
  });

  it('holds exactly qty × limit for a limit buy', () => {
    const draft: OrderDraft = {
      ...marketBuy(10 * SHARE),
      type: 'limit',
      limitTicks: ticks(990_000),
    };

    const estimate = estimateOrder(draft, ctx());

    expect(estimate.holdCents).toBe(99_000);
    expect(estimate.executesNow).toBe(false);
  });

  it('executes a marketable limit now', () => {
    const draft: OrderDraft = { ...marketBuy(SHARE), type: 'limit', limitTicks: ticks(1_000_100) };

    expect(estimateOrder(draft, ctx()).executesNow).toBe(true);
    expect(estimateOrder(draft, ctx({ session: CLOSED })).executesNow).toBe(false);
  });

  it('prices a limit with no price yet at the quote', () => {
    const draft: OrderDraft = { ...marketBuy(SHARE), type: 'limit' };

    expect(estimateOrder(draft, ctx()).priceTicks).toBe(1_000_100);
  });

  it('holds exactly the amount for a dollar market buy', () => {
    const draft: OrderDraft = { ...marketBuy(0), size: { kind: 'amount', cents: cents(100_000) } };

    const estimate = estimateOrder(draft, ctx());

    expect(estimate).toMatchObject({ notionalCents: 100_000, holdCents: 100_000 });
    expect(estimate.qtyMicros).toBe(9_999_000);
  });

  it('turns a dollar limit buy into whole micros at the limit', () => {
    const draft: OrderDraft = {
      ...marketBuy(0),
      type: 'limit',
      limitTicks: ticks(990_000),
      size: { kind: 'amount', cents: cents(100_000) },
    };

    const estimate = estimateOrder(draft, ctx());

    expect(estimate.qtyMicros).toBe(10_101_010);
    expect(estimate.holdCents).toBe(100_000);
  });

  it('estimates $1 at $3,000 a share as 333 micros', () => {
    const draft: OrderDraft = { ...marketBuy(0), size: { kind: 'amount', cents: cents(100) } };

    const estimate = estimateOrder(draft, ctx({ quote: quote(ticks(30_000_000)) }));

    expect(estimate).toMatchObject({ qtyMicros: 333, notionalCents: 100, holdCents: 100 });
  });

  it('sells everything sellable at the bid, rounding proceeds down', () => {
    const draft: OrderDraft = { side: 'sell', type: 'market', tif: 'day', size: { kind: 'all' } };

    const estimate = estimateOrder(draft, ctx({ sellableMicros: micros(3_333_333) }));

    // 3.333333 × $99.99 = $333.29997 → down.
    expect(estimate).toMatchObject({
      priceTicks: 999_900,
      qtyMicros: 3_333_333,
      notionalCents: 33_329,
      holdMicros: 3_333_333,
      holdCents: 0,
    });
  });

  it('holds enough shares for a dollar market sell at a slipped bid', () => {
    const draft: OrderDraft = {
      side: 'sell',
      type: 'market',
      tif: 'day',
      size: { kind: 'amount', cents: cents(50_000) },
    };

    const roomy = estimateOrder(draft, ctx({ sellableMicros: micros(10 * SHARE) }));
    const tight = estimateOrder(draft, ctx({ sellableMicros: micros(5_001_000) }));

    // $500 / ($99.99 × 0.9995 → $99.94) rounded up.
    expect(roomy.holdMicros).toBe(5_003_002);
    expect(roomy.qtyMicros).toBe(5_000_500);
    expect(tight.holdMicros).toBe(5_001_000);
  });

  it('holds exactly the shares of a share-sized sell', () => {
    const draft: OrderDraft = {
      side: 'sell',
      type: 'limit',
      tif: 'gtc',
      limitTicks: ticks(1_050_000),
      size: { kind: 'shares', micros: micros(2 * SHARE) },
    };

    expect(estimateOrder(draft, ctx({ sellableMicros: micros(5 * SHARE) })).holdMicros).toBe(
      2 * SHARE,
    );
  });
});

describe('validateOrder', () => {
  it('accepts a normal order', () => {
    expect(validateOrder(marketBuy(10 * SHARE), ctx())).toEqual([]);
  });

  it('ranks rejection codes in the documented precedence', () => {
    expect(REJECTION_CODES).toEqual([
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
    ]);
  });

  it.each(SIDES.flatMap((side) => ORDER_TYPES.map((type) => [side, type] as const)))(
    'blocks a %s %s order first with TRADING_DISABLED when trading is off',
    (side, type) => {
      const draft: OrderDraft = {
        side,
        type,
        tif: 'day',
        size: { kind: 'shares', micros: micros(SHARE) },
        limitTicks: ticks(1_000_000),
        stopTicks: ticks(side === 'buy' ? 1_010_000 : 990_000),
      };

      const result = codes(draft, ctx({ tradingEnabled: false, sellableMicros: micros(SHARE) }));

      expect(result).toEqual(['TRADING_DISABLED']);
    },
  );

  it('lists the platform reasons in precedence order', () => {
    const context = ctx({
      tradingEnabled: false,
      marketPaused: true,
      halted: true,
      session: CLOSED,
      rules: { ...DEFAULT_EXECUTION_RULES, queueWhenClosed: false },
    });

    expect(codes(marketBuy(10 * SHARE), context)).toEqual([
      'TRADING_DISABLED',
      'MARKET_PAUSED',
      'SYMBOL_HALTED',
      'MARKET_CLOSED',
    ]);
  });

  it('lists the order reasons in precedence order', () => {
    const draft: OrderDraft = { ...marketBuy(1), type: 'limit', limitTicks: ticks(1_200_000) };

    const result = codes(draft, ctx({ now: NOW + 6_000, buyingPowerCents: cents(0) }));

    expect(result).toEqual(['STALE_QUOTE', 'PRICE_COLLAR', 'MIN_NOTIONAL', 'INSUFFICIENT_FUNDS']);
  });

  it('shows one error per price field: a wrong-side stop is not also outside the collar', () => {
    const draft: OrderDraft = {
      side: 'sell',
      type: 'stop',
      tif: 'day',
      stopTicks: ticks(1_200_000),
      size: { kind: 'shares', micros: micros(SHARE) },
    };

    expect(codes(draft, ctx())).toEqual(['INVALID_PRICE', 'INSUFFICIENT_SHARES']);
  });

  describe('MARKET_CLOSED', () => {
    const noQueue = { ...DEFAULT_EXECUTION_RULES, queueWhenClosed: false };

    it('rejects a market order while closed when queueing is off', () => {
      expect(validateOrder(marketBuy(SHARE), ctx({ session: CLOSED, rules: noQueue }))).toEqual([
        { code: 'MARKET_CLOSED' },
      ]);
    });

    it('queues a market order while closed when queueing is on', () => {
      expect(validateOrder(marketBuy(SHARE), ctx({ session: CLOSED }))).toEqual([]);
    });

    it('lets a limit order rest while closed even when queueing is off', () => {
      const draft: OrderDraft = { ...marketBuy(SHARE), type: 'limit', limitTicks: ticks(990_000) };

      expect(validateOrder(draft, ctx({ session: CLOSED, rules: noQueue }))).toEqual([]);
    });
  });

  describe('STALE_QUOTE', () => {
    const stale = { now: NOW + 5_001 };

    it('rejects a market order in session on a stale quote', () => {
      expect(validateOrder(marketBuy(SHARE), ctx(stale))).toEqual([
        { code: 'STALE_QUOTE', ageMs: 5_001, maxAgeMs: 5_000 },
      ]);
    });

    it('accepts a quote exactly at the age limit', () => {
      expect(validateOrder(marketBuy(SHARE), ctx({ now: NOW + 5_000 }))).toEqual([]);
    });

    it('ignores staleness for a resting limit, a queued market order and a stop', () => {
      const resting: OrderDraft = {
        ...marketBuy(SHARE),
        type: 'limit',
        limitTicks: ticks(990_000),
      };
      const stop: OrderDraft = { ...marketBuy(SHARE), type: 'stop', stopTicks: ticks(1_050_000) };

      expect(validateOrder(resting, ctx(stale))).toEqual([]);
      expect(validateOrder(marketBuy(SHARE), ctx({ ...stale, session: CLOSED }))).toEqual([]);
      expect(validateOrder(stop, ctx(stale))).toEqual([]);
    });
  });

  describe('INVALID_PRICE', () => {
    const stop = (side: 'buy' | 'sell', stopTicks: number): OrderDraft => ({
      side,
      type: 'stop',
      tif: 'day',
      stopTicks: ticks(stopTicks),
      size: { kind: 'shares', micros: micros(SHARE) },
    });
    const holding = ctx({ sellableMicros: micros(10 * SHARE) });

    it('rejects a buy stop at or below the last trade', () => {
      expect(validateOrder(stop('buy', 1_000_000), holding)).toEqual([
        { code: 'INVALID_PRICE', field: 'stop', lastTicks: 1_000_000 },
      ]);
      expect(validateOrder(stop('buy', 1_000_001), holding)).toEqual([]);
    });

    it('rejects a sell stop at or above the last trade', () => {
      expect(codes(stop('sell', 1_000_000), holding)).toEqual(['INVALID_PRICE']);
      expect(validateOrder(stop('sell', 999_999), holding)).toEqual([]);
    });
  });

  describe('PRICE_COLLAR', () => {
    const limit = (limitTicks: number): OrderDraft => ({
      ...marketBuy(SHARE),
      type: 'limit',
      limitTicks: ticks(limitTicks),
    });

    it('accepts a limit exactly on the collar edge', () => {
      expect(validateOrder(limit(900_000), ctx())).toEqual([]);
    });

    it('rejects a limit outside the collar with its range', () => {
      expect(validateOrder(limit(899_999), ctx())).toEqual([
        { code: 'PRICE_COLLAR', field: 'limit', minTicks: 900_000, maxTicks: 1_100_000 },
      ]);
    });

    it('rejects a stop outside the collar on the stop field', () => {
      const draft: OrderDraft = { ...marketBuy(SHARE), type: 'stop', stopTicks: ticks(1_100_001) };

      expect(validateOrder(draft, ctx())).toEqual([
        { code: 'PRICE_COLLAR', field: 'stop', minTicks: 900_000, maxTicks: 1_100_000 },
      ]);
    });

    it('keeps the collar inside ±collar when it does not divide evenly', () => {
      expect(collarRange(ticks(1_000_001), { collarBps: bps(1_000) })).toEqual({
        minTicks: 900_001,
        maxTicks: 1_100_001,
      });
    });
  });

  describe('notional limits', () => {
    const amount = (value: number): OrderDraft => ({
      ...marketBuy(0),
      size: { kind: 'amount', cents: cents(value) },
    });

    it('rejects below the minimum and accepts the minimum', () => {
      expect(validateOrder(amount(99), ctx())).toEqual([
        { code: 'MIN_NOTIONAL', field: 'size', minCents: 100 },
      ]);
      expect(validateOrder(amount(100), ctx())).toEqual([]);
    });

    it('rejects above the maximum', () => {
      const result = validateOrder(
        amount(25_000_001),
        ctx({ buyingPowerCents: cents(30_000_000) }),
      );

      expect(result).toEqual([{ code: 'MAX_NOTIONAL', field: 'size', maxCents: 25_000_000 }]);
    });
  });

  describe('INSUFFICIENT_FUNDS', () => {
    const amount: OrderDraft = { ...marketBuy(0), size: { kind: 'amount', cents: cents(100_000) } };

    it('accepts a hold equal to buying power', () => {
      expect(validateOrder(amount, ctx({ buyingPowerCents: cents(100_000) }))).toEqual([]);
    });

    it('rejects a hold above buying power', () => {
      expect(validateOrder(amount, ctx({ buyingPowerCents: cents(99_999) }))).toEqual([
        {
          code: 'INSUFFICIENT_FUNDS',
          field: 'size',
          requiredCents: 100_000,
          availableCents: 99_999,
        },
      ]);
    });

    it('checks the slippage-padded hold, not the notional, for a share buy', () => {
      const result = validateOrder(
        marketBuy(10 * SHARE),
        ctx({ buyingPowerCents: cents(100_060) }),
      );

      expect(result).toEqual([
        {
          code: 'INSUFFICIENT_FUNDS',
          field: 'size',
          requiredCents: 100_061,
          availableCents: 100_060,
        },
      ]);
    });
  });

  describe('INSUFFICIENT_SHARES', () => {
    const sell = (qty: number): OrderDraft => ({
      side: 'sell',
      type: 'market',
      tif: 'day',
      size: { kind: 'shares', micros: micros(qty) },
    });

    it('rejects selling more than is sellable', () => {
      expect(validateOrder(sell(3 * SHARE), ctx({ sellableMicros: micros(2 * SHARE) }))).toEqual([
        { code: 'INSUFFICIENT_SHARES', field: 'size', sellableMicros: micros(2 * SHARE) },
      ]);
      expect(validateOrder(sell(2 * SHARE), ctx({ sellableMicros: micros(2 * SHARE) }))).toEqual(
        [],
      );
    });

    it('rejects selling all when nothing is sellable', () => {
      const all: OrderDraft = { ...sell(0), size: { kind: 'all' } };

      expect(codes(all, ctx())).toContain('INSUFFICIENT_SHARES');
    });
  });
});

describe('helpers', () => {
  it('asks to confirm only above 25% of equity', () => {
    expect(needsLargeOrderConfirm(cents(250_000), cents(1_000_000))).toBe(false);
    expect(needsLargeOrderConfirm(cents(250_001), cents(1_000_000))).toBe(true);
    expect(needsLargeOrderConfirm(cents(1), cents(0))).toBe(false);
  });

  it('signs slippage so positive is worse for the trader', () => {
    expect(slippageBps('buy', ticks(1_000_000), ticks(1_000_500))).toBe(5);
    expect(slippageBps('buy', ticks(1_000_000), ticks(999_500))).toBe(-5);
    expect(slippageBps('sell', ticks(1_000_000), ticks(999_500))).toBe(5);
    expect(slippageBps('sell', ticks(1_000_000), ticks(1_000_500))).toBe(-5);
    expect(slippageBps('buy', ticks(1_000_000), ticks(1_000_050))).toBe(1);
  });

  it('treats a limit as marketable when the opposite side reaches it', () => {
    const q = quote();

    expect(isMarketable('buy', ticks(1_000_100), q)).toBe(true);
    expect(isMarketable('buy', ticks(1_000_099), q)).toBe(false);
    expect(isMarketable('sell', ticks(999_900), q)).toBe(true);
    expect(isMarketable('sell', ticks(999_901), q)).toBe(false);
  });

  it('marks filled, canceled, rejected and expired as terminal', () => {
    const terminal = ORDER_STATUSES.filter((status) => isTerminal(status));

    expect(terminal).toEqual(['filled', 'canceled', 'rejected', 'expired']);
    expect(TERMINAL_STATUSES).toEqual(terminal);
  });

  it('names who or what canceled an order, including a disabled stock', () => {
    expect(CANCEL_REASONS).toEqual(['user', 'admin_reset', 'symbol_disabled']);
  });
});

describe('zero prices', () => {
  it('rejects a dollar limit at a zero price instead of throwing', () => {
    const draft: OrderDraft = {
      side: 'buy',
      type: 'limit',
      tif: 'day',
      limitTicks: ticks(0),
      size: { kind: 'amount', cents: cents(1_000) },
    };

    expect(validateOrder(draft, ctx())[0]).toEqual({
      code: 'INVALID_PRICE',
      field: 'limit',
      lastTicks: ctx().quote.lastTicks,
    });
  });
});

describe('order progress', () => {
  const progress = { qtyMicros: null, amountCents: null, filledMicros: 0, filledNotionalCents: 0 };

  it('counts the shares still working and never goes below zero', () => {
    expect(remainingQtyMicros({ ...progress, qtyMicros: 5, filledMicros: 2 })).toBe(3);
    expect(remainingQtyMicros({ ...progress, qtyMicros: 5, filledMicros: 7 })).toBe(0);
    expect(remainingQtyMicros(progress)).toBeNull();
  });

  it('counts the dollars still working on an amount order', () => {
    expect(
      remainingAmountCents({ ...progress, amountCents: 1_000, filledNotionalCents: 400 }),
    ).toBe(600);
    expect(
      remainingAmountCents({ ...progress, amountCents: 1_000, filledNotionalCents: 1_200 }),
    ).toBe(0);
    expect(remainingAmountCents(progress)).toBeNull();
  });

  it('sums the realized P&L of every fill', () => {
    expect(orderRealizedCents({ fills: [{ realizedCents: 250 }, { realizedCents: -100 }] })).toBe(
      150,
    );
    expect(orderRealizedCents({ fills: [] })).toBe(0);
  });
});
