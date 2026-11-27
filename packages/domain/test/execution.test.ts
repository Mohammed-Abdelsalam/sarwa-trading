import {
  applyFill,
  averageFillTicks,
  breakerTrips,
  cancelOutcome,
  closeOrder,
  fillQuantity,
  IllegalFillError,
  limitFillPrice,
  marketFillPrice,
  remainingMicros,
  shouldTriggerStop,
  trimWindow,
  type WorkingOrder,
} from '../src/execution';
import { type Cents, notionalCents, sharesForCents } from '../src/money';
import { type Side } from '../src/orders';
import { type Position } from '../src/portfolio';
import { spreadAround, type TradeQuote } from '../src/quote';
import { DEFAULT_CIRCUIT_BREAKER, POLICY } from '../src/rules';

const SHARE = 1_000_000;
const START: Cents = POLICY.startingCashCents;

function quote(lastTicks = 1_000_000): TradeQuote {
  return {
    lastTicks,
    ...spreadAround(lastTicks, 2),
    prevCloseTicks: lastTicks,
    bidSizeMicros: 100 * SHARE,
    askSizeMicros: 100 * SHARE,
    ts: 0,
  };
}

function order(overrides: Partial<WorkingOrder> = {}): WorkingOrder {
  return {
    side: 'buy',
    type: 'market',
    status: 'open',
    qtyMicros: 10 * SHARE,
    amountCents: null,
    limitTicks: null,
    stopTicks: null,
    filledMicros: 0,
    filledNotionalCents: 0,
    filledExactNotional: 0n,
    heldCents: 0,
    heldMicros: 0,
    holdPriceTicks: null,
    ...overrides,
  };
}

describe('fill prices', () => {
  it('fills a market order off the touch, slipped against the trader', () => {
    expect(marketFillPrice('buy', quote(), 5)).toBe(1_000_601);
    expect(marketFillPrice('sell', quote(), 5)).toBe(999_400);
    expect(marketFillPrice('buy', quote(), 0)).toBe(1_000_100);
  });

  it('does not fill a limit the market has not reached', () => {
    expect(limitFillPrice('buy', 1_000_099, quote(), 0)).toBeNull();
    expect(limitFillPrice('sell', 999_901, quote(), 0)).toBeNull();
  });

  it('fills a buy limit at its price or better', () => {
    expect(limitFillPrice('buy', 1_000_300, quote(), 5)).toBe(1_000_300);
    expect(limitFillPrice('buy', 1_100_000, quote(), 0)).toBe(1_000_100);
  });

  it('fills a sell limit at its price or better', () => {
    expect(limitFillPrice('sell', 999_900, quote(), 5)).toBe(999_900);
    expect(limitFillPrice('sell', 900_000, quote(), 0)).toBe(999_900);
  });
});

describe('stops', () => {
  it('triggers a buy stop when the last trade reaches it', () => {
    expect(shouldTriggerStop('buy', 1_050_000, 1_049_999)).toBe(false);
    expect(shouldTriggerStop('buy', 1_050_000, 1_050_000)).toBe(true);
  });

  it('triggers a sell stop when the last trade reaches it', () => {
    expect(shouldTriggerStop('sell', 950_000, 950_001)).toBe(false);
    expect(shouldTriggerStop('sell', 950_000, 950_000)).toBe(true);
  });

  it('fills a sell stop through a gap at the market, below the stop', () => {
    const gapped = quote(900_000);

    const triggered = shouldTriggerStop('sell', 950_000, gapped.lastTicks);
    const fill = marketFillPrice('sell', gapped, 5);

    expect(triggered).toBe(true);
    expect(fill).toBe(899_460);
    expect(fill).toBeLessThan(950_000);
  });
});

describe('fillQuantity', () => {
  it('buys floor(amount / price) for a dollar buy so it never spends more than the amount', () => {
    const dollarBuy = order({ qtyMicros: null, amountCents: 100_000 });

    const qty = fillQuantity(dollarBuy, 1_000_601, 0);

    expect(qty).toBe(9_993_993);
    expect(notionalCents(qty, 1_000_601, 'up')).toBeLessThanOrEqual(100_000);
  });

  it('buys 333 micros for $1 at $3,000 and charges exactly $1', () => {
    const dollarBuy = order({ qtyMicros: null, amountCents: 100 });

    const qty = fillQuantity(dollarBuy, 30_000_000, 0);
    const result = applyFill(START, null, dollarBuy, 'BIG', {
      qtyMicros: qty,
      priceTicks: 30_000_000,
    });

    expect(qty).toBe(333);
    expect(result.notionalCents).toBe(100);
    expect(result.cashCents).toBe(START - 100);
  });

  it('sells enough shares for a dollar sell, capped at the shares held for it', () => {
    const dollarSell = order({ side: 'sell', qtyMicros: null, amountCents: 50_000 });

    expect(fillQuantity({ ...dollarSell, heldMicros: 6 * SHARE }, 999_400, 0)).toBe(5_003_002);
    expect(fillQuantity({ ...dollarSell, heldMicros: 5 * SHARE }, 999_400, 0)).toBe(5 * SHARE);
  });

  it('fills a limit up to the displayed size', () => {
    const limit = order({ type: 'limit', filledMicros: 2 * SHARE });

    expect(fillQuantity(limit, 1_000_000, 3 * SHARE)).toBe(3 * SHARE);
    expect(fillQuantity(limit, 1_000_000, 50 * SHARE)).toBe(8 * SHARE);
  });

  it('fills a market order completely whatever is displayed', () => {
    expect(fillQuantity(order(), 1_000_000, SHARE)).toBe(10 * SHARE);
  });

  it('has nothing remaining on an order with no share count', () => {
    expect(remainingMicros(order({ qtyMicros: null }))).toBe(0);
    expect(remainingMicros(order({ filledMicros: 4 * SHARE }))).toBe(6 * SHARE);
  });
});

describe('applyFill', () => {
  it('debits a buy rounded up and adds it to the cost basis', () => {
    const result = applyFill(START, null, order({ holdPriceTicks: 2_000_000 }), 'AAA', {
      qtyMicros: 10 * SHARE,
      priceTicks: 1_000_601,
    });

    expect(result.notionalCents).toBe(100_061);
    expect(result.cashCents).toBe(START - 100_061);
    expect(result.position).toEqual({
      symbol: 'AAA',
      qtyMicros: 10 * SHARE,
      costBasisCents: 100_061,
    });
    expect(result.realizedCents).toBe(0);
    expect(result.order).toMatchObject({
      status: 'filled',
      filledMicros: 10 * SHARE,
      filledNotionalCents: 100_061,
      heldCents: 0,
    });
  });

  it('re-computes the remaining hold at the hold price after each partial buy', () => {
    const working = order({ type: 'limit', holdPriceTicks: 1_050_105, heldCents: 105_011 });

    const first = applyFill(START, null, working, 'AAA', {
      qtyMicros: 4 * SHARE,
      priceTicks: 1_000_100,
    });
    const second = applyFill(first.cashCents, first.position, first.order, 'AAA', {
      qtyMicros: 6 * SHARE,
      priceTicks: 1_000_000,
    });

    // 6 × $105.0105 rounded up.
    expect(first.order).toMatchObject({ status: 'partially_filled', heldCents: 63_007 });
    expect(second.order).toMatchObject({
      status: 'filled',
      heldCents: 0,
      filledMicros: 10 * SHARE,
      filledNotionalCents: 40_004 + 60_000,
    });
    expect(second.position?.costBasisCents).toBe(100_004);
  });

  it('records the share count of a dollar buy at the fill', () => {
    const dollarBuy = order({ qtyMicros: null, amountCents: 100_000, heldCents: 100_000 });

    const result = applyFill(START, null, dollarBuy, 'AAA', {
      qtyMicros: 9_999_000,
      priceTicks: 1_000_100,
    });

    expect(result.order).toMatchObject({ qtyMicros: 9_999_000, status: 'filled', heldCents: 0 });
  });

  it('credits a partial sell rounded down and removes its share of the basis', () => {
    const position: Position = { symbol: 'AAA', qtyMicros: 10 * SHARE, costBasisCents: 100_001 };
    const sell = order({ side: 'sell', type: 'limit', heldMicros: 10 * SHARE });

    const result = applyFill(0, position, sell, 'AAA', {
      qtyMicros: 3 * SHARE,
      priceTicks: 1_100_000,
    });

    expect(result.notionalCents).toBe(33_000);
    expect(result.cashCents).toBe(33_000);
    expect(result.realizedCents).toBe(33_000 - 30_000);
    expect(result.position).toEqual({
      symbol: 'AAA',
      qtyMicros: 7 * SHARE,
      costBasisCents: 70_001,
    });
    expect(result.order).toMatchObject({ status: 'partially_filled', heldMicros: 7 * SHARE });
  });

  it('removes all remaining basis when selling the whole position after mixed buys', () => {
    const buy1 = applyFill(
      START,
      null,
      order({ qtyMicros: 3 * SHARE, holdPriceTicks: 2_000_000 }),
      'AAA',
      {
        qtyMicros: 3 * SHARE,
        priceTicks: 1_000_100,
      },
    );
    const buy2 = applyFill(
      buy1.cashCents,
      buy1.position,
      order({ qtyMicros: 7 * SHARE, holdPriceTicks: 2_000_000 }),
      'AAA',
      {
        qtyMicros: 7 * SHARE,
        priceTicks: 1_033_333,
      },
    );
    const sellOrder = order({ side: 'sell', type: 'limit', heldMicros: 10 * SHARE });
    const part = applyFill(buy2.cashCents, buy2.position, sellOrder, 'AAA', {
      qtyMicros: 3 * SHARE,
      priceTicks: 1_010_000,
    });
    const rest = applyFill(part.cashCents, part.position, part.order, 'AAA', {
      qtyMicros: 7 * SHARE,
      priceTicks: 1_010_000,
    });

    expect(buy2.position?.costBasisCents).toBe(30_003 + 72_334);
    expect(part.position?.costBasisCents).toBe(102_337 - 30_701);
    expect(rest.position).toBeNull();
    expect(rest.realizedCents).toBe(70_700 - 71_636);
    expect(rest.order).toMatchObject({ status: 'filled', heldMicros: 0 });
    expect(rest.cashCents).toBe(START + part.realizedCents + rest.realizedCents);
  });

  it('refuses a non-positive quantity', () => {
    expect(() => applyFill(START, null, order(), 'AAA', { qtyMicros: 0, priceTicks: 1 })).toThrow(
      IllegalFillError,
    );
  });

  it.each(['filled', 'canceled', 'rejected', 'expired'] as const)(
    'refuses to fill an order that is %s',
    (status) => {
      expect(() =>
        applyFill(START, null, order({ status }), 'AAA', { qtyMicros: SHARE, priceTicks: 1 }),
      ).toThrow(`Can't fill an order that is ${status}`);
    },
  );

  it('refuses a fill beyond the remaining quantity', () => {
    const partial = order({ status: 'partially_filled', filledMicros: 8 * SHARE });

    expect(() =>
      applyFill(START, null, partial, 'AAA', { qtyMicros: 3 * SHARE, priceTicks: 1 }),
    ).toThrow('remaining');
  });

  it('refuses to sell shares that are not held', () => {
    const sell = order({ side: 'sell', qtyMicros: null, amountCents: 1_000 });
    const position: Position = { symbol: 'AAA', qtyMicros: SHARE, costBasisCents: 100 };

    expect(() => applyFill(0, null, sell, 'AAA', { qtyMicros: SHARE, priceTicks: 1 })).toThrow(
      'Not enough shares',
    );
    expect(() =>
      applyFill(0, position, sell, 'AAA', { qtyMicros: SHARE + 1, priceTicks: 1 }),
    ).toThrow('Not enough shares');
  });
});

describe('order lifecycle', () => {
  it('averages the fill price across fills', () => {
    expect(averageFillTicks({ filledMicros: 3 * SHARE, filledNotionalCents: 30_003 })).toBe(
      1_000_100,
    );
    expect(averageFillTicks({ filledMicros: 0, filledNotionalCents: 0 })).toBe(0);
  });

  it.each([
    ['queued', 'canceled'],
    ['open', 'canceled'],
    ['partially_filled', 'canceled'],
    ['filled', 'already_filled'],
    ['canceled', 'already_closed'],
    ['rejected', 'already_closed'],
    ['expired', 'already_closed'],
  ] as const)('answers a cancel on a %s order with %s', (status, outcome) => {
    expect(cancelOutcome(status)).toBe(outcome);
  });

  it('tells a cancel that lost the race to the fill that the order already filled', () => {
    const working = order({ type: 'limit', holdPriceTicks: 1_000_000, heldCents: 100_000 });

    const filled = applyFill(START, null, working, 'AAA', {
      qtyMicros: 10 * SHARE,
      priceTicks: 1_000_000,
    });

    expect(cancelOutcome(filled.order.status)).toBe('already_filled');
  });

  it('keeps the fills and releases every hold when a partial order is canceled', () => {
    const working = order({ type: 'limit', holdPriceTicks: 1_000_000, heldCents: 100_000 });
    const partial = applyFill(START, null, working, 'AAA', {
      qtyMicros: 4 * SHARE,
      priceTicks: 1_000_000,
    });

    const outcome = cancelOutcome(partial.order.status);
    const closed = closeOrder(partial.order, 'canceled');

    expect(outcome).toBe('canceled');
    expect(closed).toMatchObject({
      status: 'canceled',
      filledMicros: 4 * SHARE,
      heldCents: 0,
      heldMicros: 0,
    });
  });
});

describe('circuit breaker', () => {
  const rules = DEFAULT_CIRCUIT_BREAKER;
  const at = (ticks: number, t = 0) => ({ t, ticks });

  it('keeps only points inside the window', () => {
    const points = [at(1, 400), at(2, 500), at(3, 900)];

    expect(trimWindow(points, 1_000, 500)).toEqual([at(2, 500), at(3, 900)]);
  });

  it('trips on a move of the threshold up from the low', () => {
    expect(breakerTrips([at(1_000_000)], 1_100_000, rules)).toBe(true);
    expect(breakerTrips([at(1_000_000)], 1_099_999, rules)).toBe(false);
  });

  it('trips on a move of the threshold down from the high', () => {
    expect(breakerTrips([at(1_000_000)], 900_000, rules)).toBe(true);
    expect(breakerTrips([at(1_000_000)], 900_001, rules)).toBe(false);
  });

  it('catches a fast round trip from the window low', () => {
    expect(breakerTrips([at(1_000_000), at(900_000)], 990_000, rules)).toBe(true);
  });

  it('never trips when disabled or with no history', () => {
    expect(breakerTrips([at(1_000_000)], 2_000_000, { ...rules, enabled: false })).toBe(false);
    expect(breakerTrips([], 2_000_000, rules)).toBe(false);
  });
});

// Deterministic PRNG (mulberry32) so a failing seed can be replayed.
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const MAX_FILLS = 3;

// Random limit orders filled in up to three partials at the limit or better; returns every broken invariant.
function simulateBooks(seed: number, steps: number): string[] {
  const rand = prng(seed);
  const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
  const positions = new Map<string, Position>();
  const problems: string[] = [];
  let cash = START;
  let realized = 0;

  const check = (label: string, held: number) => {
    const basis = [...positions.values()].reduce((sum, p) => sum + p.costBasisCents, 0);
    if (cash !== START + realized - basis) problems.push(`${label}: cash identity`);
    if (cash < 0) problems.push(`${label}: negative cash`);
    if (cash - held < 0) problems.push(`${label}: negative buying power`);
    for (const p of positions.values()) {
      if (p.qtyMicros <= 0 || p.costBasisCents < 0) problems.push(`${label}: bad position`);
    }
  };

  for (let step = 0; step < steps; step += 1) {
    const symbol = ['AAA', 'BBB', 'CCC'][int(0, 2)]!;
    const limit = int(10_000, 50_000_000);
    const held = positions.get(symbol);
    const side: Side = held && rand() < 0.45 ? 'sell' : 'buy';
    let total: number;
    if (side === 'sell' && held) {
      total = rand() < 0.3 ? held.qtyMicros : int(1, held.qtyMicros);
    } else {
      const affordable = sharesForCents(cash, limit, 'down');
      if (affordable < 1) continue;
      total = int(1, Math.min(affordable, 200 * SHARE));
    }
    let working = order({
      side,
      type: 'limit',
      qtyMicros: total,
      limitTicks: limit,
      holdPriceTicks: side === 'buy' ? limit : null,
      heldCents: side === 'buy' ? notionalCents(total, limit, 'up') : 0,
      heldMicros: side === 'sell' ? total : 0,
    });

    for (let fill = 1; working.status !== 'filled'; fill += 1) {
      const remaining = remainingMicros(working);
      const qty = fill === MAX_FILLS || rand() < 0.4 ? remaining : int(1, remaining);
      const improvement = int(0, Math.floor(limit / 100));
      const price = side === 'buy' ? limit - improvement : limit + improvement;
      const before = positions.get(symbol) ?? null;

      const result = applyFill(cash, before, working, symbol, {
        qtyMicros: qty,
        priceTicks: price,
      });

      cash = result.cashCents;
      realized += result.realizedCents;
      working = result.order;
      if (result.position) positions.set(symbol, result.position);
      else positions.delete(symbol);
      const closed = side === 'sell' && before !== null && qty === before.qtyMicros;
      if (closed && result.realizedCents !== result.notionalCents - before.costBasisCents) {
        problems.push(`seed ${seed} step ${step}: full close left basis behind`);
      }
      check(`seed ${seed} step ${step}`, working.heldCents);
    }
  }
  return problems;
}

describe('books (property)', () => {
  it('keeps the cash identity, non-negative cash and clean closes over random fills', () => {
    const problems = Array.from({ length: 300 }, (_, seed) => simulateBooks(seed + 1, 40)).flat();

    expect(problems).toEqual([]);
  });
});

describe('partial fills and rounding', () => {
  it('never spends more than the hold when a limit buy fills in parts at its limit', () => {
    const limit = 1_000_050;
    const hold = notionalCents(2 * SHARE, limit, 'up');
    const working = order({
      type: 'limit',
      qtyMicros: 2 * SHARE,
      limitTicks: limit,
      holdPriceTicks: limit,
      heldCents: hold,
    });

    const first = applyFill(hold, null, working, 'AAA', { qtyMicros: SHARE, priceTicks: limit });
    const second = applyFill(first.cashCents, first.position, first.order, 'AAA', {
      qtyMicros: SHARE,
      priceTicks: limit,
    });

    expect(first.cashCents - first.order.heldCents).toBeGreaterThanOrEqual(0);
    expect(second.cashCents).toBe(0);
    expect(second.position?.costBasisCents).toBe(hold);
  });

  it('refuses a share-sized buy that has no hold price instead of dropping its hold', () => {
    expect(() =>
      applyFill(START, null, order({ qtyMicros: 2 * SHARE }), 'AAA', {
        qtyMicros: SHARE,
        priceTicks: 1_000_000,
      }),
    ).toThrow(IllegalFillError);
  });
});
