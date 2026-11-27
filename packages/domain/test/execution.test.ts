import {
  applyFill,
  averageFillTicks,
  breakerTrips,
  cancelOutcome,
  closeOrder,
  fillNotionalCents,
  fillQuantity,
  IllegalFillError,
  limitFillPrice,
  marketFillPrice,
  remainingMicros,
  shouldTriggerStop,
  trimWindow,
  type WorkingOrder,
} from '../src/execution';
import {
  bps,
  cents,
  type Cents,
  micros,
  type Micros,
  notionalCents,
  scaleBps,
  sharesForCents,
  ticks,
  type Ticks,
} from '../src/money';
import { type Side } from '../src/orders';
import { type Position } from '../src/portfolio';
import { spreadAround, type TradeQuote } from '../src/quote';
import { DEFAULT_CIRCUIT_BREAKER, POLICY } from '../src/rules';

const SHARE = 1_000_000;
const START: Cents = POLICY.startingCashCents;

function quote(lastTicks = ticks(1_000_000)): TradeQuote {
  return {
    lastTicks,
    ...spreadAround(lastTicks, bps(2)),
    prevCloseTicks: lastTicks,
    bidSizeMicros: micros(100 * SHARE),
    askSizeMicros: micros(100 * SHARE),
    ts: 0,
  };
}

function order(overrides: Partial<WorkingOrder> = {}): WorkingOrder {
  return {
    side: 'buy',
    type: 'market',
    status: 'open',
    qtyMicros: micros(10 * SHARE),
    amountCents: null,
    limitTicks: null,
    stopTicks: null,
    filledMicros: micros(0),
    filledNotionalCents: cents(0),
    filledExactNotional: 0n,
    heldCents: cents(0),
    heldMicros: micros(0),
    holdPriceTicks: null,
    holdBudgetCents: null,
    ...overrides,
  };
}

describe('fill prices', () => {
  it('fills a market order off the touch, slipped against the trader', () => {
    expect(marketFillPrice('buy', quote(), bps(5))).toBe(1_000_601);
    expect(marketFillPrice('sell', quote(), bps(5))).toBe(999_400);
    expect(marketFillPrice('buy', quote(), bps(0))).toBe(1_000_100);
  });

  it('does not fill a limit the market has not reached', () => {
    expect(limitFillPrice('buy', ticks(1_000_099), quote(), bps(0))).toBeNull();
    expect(limitFillPrice('sell', ticks(999_901), quote(), bps(0))).toBeNull();
  });

  it('fills a buy limit at its price or better', () => {
    expect(limitFillPrice('buy', ticks(1_000_300), quote(), bps(5))).toBe(1_000_300);
    expect(limitFillPrice('buy', ticks(1_100_000), quote(), bps(0))).toBe(1_000_100);
  });

  it('fills a sell limit at its price or better', () => {
    expect(limitFillPrice('sell', ticks(999_900), quote(), bps(5))).toBe(999_900);
    expect(limitFillPrice('sell', ticks(900_000), quote(), bps(0))).toBe(999_900);
  });
});

describe('stops', () => {
  it('triggers a buy stop when the last trade reaches it', () => {
    expect(shouldTriggerStop('buy', ticks(1_050_000), ticks(1_049_999))).toBe(false);
    expect(shouldTriggerStop('buy', ticks(1_050_000), ticks(1_050_000))).toBe(true);
  });

  it('triggers a sell stop when the last trade reaches it', () => {
    expect(shouldTriggerStop('sell', ticks(950_000), ticks(950_001))).toBe(false);
    expect(shouldTriggerStop('sell', ticks(950_000), ticks(950_000))).toBe(true);
  });

  it('fills a sell stop through a gap at the market, below the stop', () => {
    const gapped = quote(ticks(900_000));

    const triggered = shouldTriggerStop('sell', ticks(950_000), gapped.lastTicks);
    const fill = marketFillPrice('sell', gapped, bps(5));

    expect(triggered).toBe(true);
    expect(fill).toBe(899_460);
    expect(fill).toBeLessThan(950_000);
  });
});

describe('fillQuantity', () => {
  it('buys floor(amount / price) for a dollar buy so it never spends more than the amount', () => {
    const dollarBuy = order({ qtyMicros: null, amountCents: cents(100_000) });

    const qty = fillQuantity(dollarBuy, ticks(1_000_601), micros(0));

    expect(qty).toBe(9_993_993);
    expect(notionalCents(qty, ticks(1_000_601), 'up')).toBeLessThanOrEqual(100_000);
  });

  it('buys 333 micros for $1 at $3,000 and charges exactly $1', () => {
    const dollarBuy = order({ qtyMicros: null, amountCents: cents(100) });

    const qty = fillQuantity(dollarBuy, ticks(30_000_000), micros(0));
    const result = applyFill(START, null, dollarBuy, 'BIG', {
      qtyMicros: qty,
      priceTicks: ticks(30_000_000),
    });

    expect(qty).toBe(333);
    expect(result.notionalCents).toBe(100);
    expect(result.cashCents).toBe(START - 100);
  });

  it('sells enough shares for a dollar sell, capped at the shares held for it', () => {
    const dollarSell = order({ side: 'sell', qtyMicros: null, amountCents: cents(50_000) });

    expect(
      fillQuantity({ ...dollarSell, heldMicros: micros(6 * SHARE) }, ticks(999_400), micros(0)),
    ).toBe(5_003_002);
    expect(
      fillQuantity({ ...dollarSell, heldMicros: micros(5 * SHARE) }, ticks(999_400), micros(0)),
    ).toBe(5 * SHARE);
  });

  it('fills a limit up to the displayed size', () => {
    const limit = order({ type: 'limit', filledMicros: micros(2 * SHARE) });

    expect(fillQuantity(limit, ticks(1_000_000), micros(3 * SHARE))).toBe(3 * SHARE);
    expect(fillQuantity(limit, ticks(1_000_000), micros(50 * SHARE))).toBe(8 * SHARE);
  });

  it('fills nothing on a limit when the displayed size is 0', () => {
    expect(fillQuantity(order({ type: 'limit' }), ticks(1_000_000), micros(0))).toBe(0);
  });

  it('fills a market order completely whatever is displayed', () => {
    expect(fillQuantity(order(), ticks(1_000_000), micros(SHARE))).toBe(10 * SHARE);
  });

  it('has nothing remaining on an order with no share count', () => {
    expect(remainingMicros(order({ qtyMicros: null }))).toBe(0);
    expect(remainingMicros(order({ filledMicros: micros(4 * SHARE) }))).toBe(6 * SHARE);
  });
});

describe('applyFill', () => {
  it('debits a buy rounded up and adds it to the cost basis', () => {
    const result = applyFill(START, null, order({ holdPriceTicks: ticks(2_000_000) }), 'AAA', {
      qtyMicros: micros(10 * SHARE),
      priceTicks: ticks(1_000_601),
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
    const working = order({
      type: 'limit',
      holdPriceTicks: ticks(1_050_105),
      heldCents: cents(105_011),
    });

    const first = applyFill(START, null, working, 'AAA', {
      qtyMicros: micros(4 * SHARE),
      priceTicks: ticks(1_000_100),
    });
    const second = applyFill(first.cashCents, first.position, first.order, 'AAA', {
      qtyMicros: micros(6 * SHARE),
      priceTicks: ticks(1_000_000),
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

  it('keeps the full hold for the rest after a partial buy is repriced lower', () => {
    const placed = order({
      type: 'limit',
      qtyMicros: micros(100 * SHARE),
      limitTicks: ticks(1_000_000),
      holdPriceTicks: ticks(1_000_000),
      heldCents: cents(1_000_000),
      holdBudgetCents: cents(1_000_000),
    });
    const first = applyFill(START, null, placed, 'AAA', {
      qtyMicros: micros(50 * SHARE),
      priceTicks: ticks(1_000_000),
    });
    const newHold = notionalCents(micros(50 * SHARE), ticks(900_000), 'up');
    const modified = {
      ...first.order,
      limitTicks: ticks(900_000),
      holdPriceTicks: ticks(900_000),
      heldCents: newHold,
      holdBudgetCents: cents(first.order.filledNotionalCents + newHold),
    };

    const second = applyFill(first.cashCents, first.position, modified, 'AAA', {
      qtyMicros: micros(10 * SHARE),
      priceTicks: ticks(900_000),
    });

    // 40 × $90 still to buy.
    expect(second.order.heldCents).toBe(360_000);
  });

  it('records the share count of a dollar buy at the fill', () => {
    const dollarBuy = order({
      qtyMicros: null,
      amountCents: cents(100_000),
      heldCents: cents(100_000),
    });

    const result = applyFill(START, null, dollarBuy, 'AAA', {
      qtyMicros: micros(9_999_000),
      priceTicks: ticks(1_000_100),
    });

    expect(result.order).toMatchObject({ qtyMicros: 9_999_000, status: 'filled', heldCents: 0 });
  });

  it('credits a partial sell rounded down and removes its share of the basis', () => {
    const position: Position = {
      symbol: 'AAA',
      qtyMicros: micros(10 * SHARE),
      costBasisCents: cents(100_001),
    };
    const sell = order({ side: 'sell', type: 'limit', heldMicros: micros(10 * SHARE) });

    const result = applyFill(cents(0), position, sell, 'AAA', {
      qtyMicros: micros(3 * SHARE),
      priceTicks: ticks(1_100_000),
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
      order({ qtyMicros: micros(3 * SHARE), holdPriceTicks: ticks(2_000_000) }),
      'AAA',
      {
        qtyMicros: micros(3 * SHARE),
        priceTicks: ticks(1_000_100),
      },
    );
    const buy2 = applyFill(
      buy1.cashCents,
      buy1.position,
      order({ qtyMicros: micros(7 * SHARE), holdPriceTicks: ticks(2_000_000) }),
      'AAA',
      {
        qtyMicros: micros(7 * SHARE),
        priceTicks: ticks(1_033_333),
      },
    );
    const sellOrder = order({ side: 'sell', type: 'limit', heldMicros: micros(10 * SHARE) });
    const part = applyFill(buy2.cashCents, buy2.position, sellOrder, 'AAA', {
      qtyMicros: micros(3 * SHARE),
      priceTicks: ticks(1_010_000),
    });
    const rest = applyFill(part.cashCents, part.position, part.order, 'AAA', {
      qtyMicros: micros(7 * SHARE),
      priceTicks: ticks(1_010_000),
    });

    expect(buy2.position?.costBasisCents).toBe(30_003 + 72_334);
    expect(part.position?.costBasisCents).toBe(102_337 - 30_701);
    expect(rest.position).toBeNull();
    expect(rest.realizedCents).toBe(70_700 - 71_636);
    expect(rest.order).toMatchObject({ status: 'filled', heldMicros: 0 });
    expect(rest.cashCents).toBe(START + part.realizedCents + rest.realizedCents);
  });

  it('refuses a buy stop that gaps past its hold instead of taking cash below 0', () => {
    const holdPrice = scaleBps(ticks(1_050_000), bps(500), 'up');
    const hold = notionalCents(micros(900 * SHARE), holdPrice, 'up');
    const stop = order({
      type: 'stop',
      qtyMicros: micros(900 * SHARE),
      stopTicks: ticks(1_050_000),
      holdPriceTicks: holdPrice,
      heldCents: hold,
    });
    const price = marketFillPrice('buy', quote(ticks(1_200_000)), bps(5));

    const fill = () =>
      applyFill(hold, null, stop, 'AAA', { qtyMicros: micros(900 * SHARE), priceTicks: price });

    expect(hold).toBe(9_922_500);
    expect(
      fillNotionalCents(stop, { qtyMicros: micros(900 * SHARE), priceTicks: price }),
    ).toBeGreaterThan(hold);
    expect(fill).toThrow(IllegalFillError);
  });

  it('charges each partial fill the change in the rounded running total', () => {
    const working = order({ type: 'limit', holdPriceTicks: ticks(1_000_050) });
    const first = applyFill(START, null, working, 'AAA', {
      qtyMicros: micros(SHARE),
      priceTicks: ticks(1_000_050),
    });

    const second = fillNotionalCents(first.order, {
      qtyMicros: micros(SHARE),
      priceTicks: ticks(1_000_050),
    });

    expect(first.notionalCents).toBe(10_001);
    expect(second).toBe(10_000);
  });

  it('refuses a non-positive quantity', () => {
    expect(() =>
      applyFill(START, null, order(), 'AAA', { qtyMicros: micros(0), priceTicks: ticks(1) }),
    ).toThrow(IllegalFillError);
  });

  it.each(['filled', 'canceled', 'rejected', 'expired'] as const)(
    'refuses to fill an order that is %s',
    (status) => {
      expect(() =>
        applyFill(START, null, order({ status }), 'AAA', {
          qtyMicros: micros(SHARE),
          priceTicks: ticks(1),
        }),
      ).toThrow(`Can't fill an order that is ${status}`);
    },
  );

  it('refuses a fill beyond the remaining quantity', () => {
    const partial = order({ status: 'partially_filled', filledMicros: micros(8 * SHARE) });

    expect(() =>
      applyFill(START, null, partial, 'AAA', {
        qtyMicros: micros(3 * SHARE),
        priceTicks: ticks(1),
      }),
    ).toThrow('remaining');
  });

  it('refuses to sell shares that are not held', () => {
    const sell = order({ side: 'sell', qtyMicros: null, amountCents: cents(1_000) });
    const position: Position = {
      symbol: 'AAA',
      qtyMicros: micros(SHARE),
      costBasisCents: cents(100),
    };

    expect(() =>
      applyFill(cents(0), null, sell, 'AAA', { qtyMicros: micros(SHARE), priceTicks: ticks(1) }),
    ).toThrow('Not enough shares');
    expect(() =>
      applyFill(cents(0), position, sell, 'AAA', {
        qtyMicros: micros(SHARE + 1),
        priceTicks: ticks(1),
      }),
    ).toThrow('Not enough shares');
  });
});

describe('order lifecycle', () => {
  it('averages the fill price across fills', () => {
    expect(
      averageFillTicks({ filledMicros: micros(3 * SHARE), filledNotionalCents: cents(30_003) }),
    ).toBe(1_000_100);
    expect(averageFillTicks({ filledMicros: micros(0), filledNotionalCents: cents(0) })).toBe(0);
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
    const working = order({
      type: 'limit',
      holdPriceTicks: ticks(1_000_000),
      heldCents: cents(100_000),
    });

    const filled = applyFill(START, null, working, 'AAA', {
      qtyMicros: micros(10 * SHARE),
      priceTicks: ticks(1_000_000),
    });

    expect(cancelOutcome(filled.order.status)).toBe('already_filled');
  });

  it('keeps the fills and releases every hold when a partial order is canceled', () => {
    const working = order({
      type: 'limit',
      holdPriceTicks: ticks(1_000_000),
      heldCents: cents(100_000),
    });
    const partial = applyFill(START, null, working, 'AAA', {
      qtyMicros: micros(4 * SHARE),
      priceTicks: ticks(1_000_000),
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
  const at = (price: number, t = 0) => ({ t, ticks: ticks(price) });

  it('keeps only points inside the window', () => {
    const points = [at(1, 400), at(2, 500), at(3, 900)];

    expect(trimWindow(points, 1_000, 500)).toEqual([at(2, 500), at(3, 900)]);
  });

  it('trips on a move of the threshold up from the low', () => {
    expect(breakerTrips([at(1_000_000)], ticks(1_100_000), rules)).toBe(true);
    expect(breakerTrips([at(1_000_000)], ticks(1_099_999), rules)).toBe(false);
  });

  it('trips on a move of the threshold down from the high', () => {
    expect(breakerTrips([at(1_000_000)], ticks(900_000), rules)).toBe(true);
    expect(breakerTrips([at(1_000_000)], ticks(900_001), rules)).toBe(false);
  });

  it('catches a fast round trip from the window low', () => {
    expect(breakerTrips([at(1_000_000), at(900_000)], ticks(990_000), rules)).toBe(true);
  });

  it('never trips when disabled or with no history', () => {
    expect(breakerTrips([at(1_000_000)], ticks(2_000_000), { ...rules, enabled: false })).toBe(
      false,
    );
    expect(breakerTrips([], ticks(2_000_000), rules)).toBe(false);
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
const MAX_GAP_BPS = 2_500;

// Random limit, market and stop orders. Limits fill in up to three partials at the limit or better;
// market and stop orders fill whole at a price gapped up to ±25% from the reference, and a buy the
// cash can't cover must be refused. Returns every broken invariant.
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
    const label = `seed ${seed} step ${step}`;
    const symbol = ['AAA', 'BBB', 'CCC'][int(0, 2)]!;
    const type = (['limit', 'market', 'stop'] as const)[int(0, 2)]!;
    const ref = ticks(int(10_000, 50_000_000));
    const held = positions.get(symbol);
    const side: Side = held && rand() < 0.45 ? 'sell' : 'buy';
    const byAmount = side === 'buy' && type === 'market' && rand() < 0.3;
    const holdPrice =
      side !== 'buy' || byAmount
        ? null
        : type === 'limit'
          ? ref
          : scaleBps(ref, bps(type === 'stop' ? 500 : 5), 'up');
    let working: WorkingOrder;
    if (byAmount) {
      if (cash < 100) continue;
      const amount = rand() < 0.3 ? cash : cents(int(100, cash));
      working = order({ qtyMicros: null, amountCents: amount, heldCents: amount });
    } else {
      let total: Micros;
      if (side === 'sell' && held) {
        total = rand() < 0.3 ? held.qtyMicros : micros(int(1, held.qtyMicros));
      } else {
        const affordable = micros(Math.min(sharesForCents(cash, holdPrice!, 'down'), 200 * SHARE));
        if (affordable < 1) continue;
        total = rand() < 0.3 ? affordable : micros(int(1, affordable));
      }
      working = order({
        side,
        type,
        qtyMicros: total,
        limitTicks: type === 'limit' ? ref : null,
        stopTicks: type === 'stop' ? ref : null,
        holdPriceTicks: holdPrice,
        heldCents: holdPrice === null ? cents(0) : notionalCents(total, holdPrice, 'up'),
        heldMicros: side === 'sell' ? total : micros(0),
      });
    }

    for (let fill = 1; working.status !== 'filled'; fill += 1) {
      let price: Ticks;
      let qty: Micros;
      if (type === 'limit') {
        const remaining = remainingMicros(working);
        qty = fill === MAX_FILLS || rand() < 0.4 ? remaining : micros(int(1, remaining));
        const improvement = int(0, Math.floor(ref / 100));
        price = ticks(side === 'buy' ? ref - improvement : ref + improvement);
      } else {
        const gap = bps(int(-MAX_GAP_BPS, MAX_GAP_BPS));
        price = ticks(Math.max(1, scaleBps(ref, gap, 'nearest')));
        qty = fillQuantity(working, price, micros(0));
        if (qty <= 0) break;
      }
      const before = positions.get(symbol) ?? null;

      let result;
      try {
        result = applyFill(cash, before, working, symbol, { qtyMicros: qty, priceTicks: price });
      } catch (error) {
        const cost = fillNotionalCents(working, { qtyMicros: qty, priceTicks: price });
        if (!(error instanceof IllegalFillError) || side !== 'buy' || cost <= cash) {
          problems.push(`${label}: refused a fill the cash covers`);
        }
        working = closeOrder(working, 'rejected');
        check(label, working.heldCents);
        break;
      }

      cash = result.cashCents;
      realized += result.realizedCents;
      working = result.order;
      if (result.position) positions.set(symbol, result.position);
      else positions.delete(symbol);
      const closed = side === 'sell' && before !== null && qty === before.qtyMicros;
      if (closed && result.realizedCents !== result.notionalCents - before.costBasisCents) {
        problems.push(`${label}: full close left basis behind`);
      }
      check(label, working.heldCents);
    }
  }
  return problems;
}

describe('books (property)', () => {
  it('keeps the cash identity, non-negative cash and buying power over random gapped fills', () => {
    const problems = Array.from({ length: 300 }, (_, seed) => simulateBooks(seed + 1, 40)).flat();

    expect(problems).toEqual([]);
  });
});

describe('partial fills and rounding', () => {
  it('never spends more than the hold when a limit buy fills in parts at its limit', () => {
    const limit = ticks(1_000_050);
    const hold = notionalCents(micros(2 * SHARE), limit, 'up');
    const working = order({
      type: 'limit',
      qtyMicros: micros(2 * SHARE),
      limitTicks: limit,
      holdPriceTicks: limit,
      heldCents: hold,
    });

    const first = applyFill(hold, null, working, 'AAA', {
      qtyMicros: micros(SHARE),
      priceTicks: limit,
    });
    const second = applyFill(first.cashCents, first.position, first.order, 'AAA', {
      qtyMicros: micros(SHARE),
      priceTicks: limit,
    });

    expect(first.cashCents - first.order.heldCents).toBeGreaterThanOrEqual(0);
    expect(second.cashCents).toBe(0);
    expect(second.position?.costBasisCents).toBe(hold);
  });

  it('refuses a share-sized buy that has no hold price instead of dropping its hold', () => {
    expect(() =>
      applyFill(START, null, order({ qtyMicros: micros(2 * SHARE) }), 'AAA', {
        qtyMicros: micros(SHARE),
        priceTicks: ticks(1_000_000),
      }),
    ).toThrow(IllegalFillError);
  });
});
