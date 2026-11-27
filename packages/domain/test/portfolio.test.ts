import { cents, micros, ticks } from '../src/money';
import {
  averageCostTicks,
  buyingPowerCents,
  type Hold,
  marketValueCents,
  type PortfolioInput,
  type PositionInput,
  reservedCents,
  sellableMicros,
  summarizePortfolio,
} from '../src/portfolio';
import { POLICY } from '../src/rules';

const SHARE = 1_000_000;
const START = POLICY.startingCashCents;
const shares = (count: number) => micros(count * SHARE);

const hold = (
  overrides: Partial<Pick<Hold, 'side' | 'symbol'>> & { cents?: number; shares?: number },
): Hold => ({
  side: overrides.side ?? 'buy',
  symbol: overrides.symbol ?? 'AAA',
  heldCents: cents(overrides.cents ?? 0),
  heldMicros: shares(overrides.shares ?? 0),
});

function row(
  symbol: string,
  sector: string,
  count: number,
  basisCents: number,
  lastTicks: number,
  prevCloseTicks: number,
  today?: { qtyAtOpenMicros: number; boughtCents: number; soldCents: number },
): PositionInput {
  return {
    position: { symbol, qtyMicros: shares(count), costBasisCents: cents(basisCents) },
    sector,
    lastTicks: ticks(lastTicks),
    prevCloseTicks: ticks(prevCloseTicks),
    ...(today
      ? {
          today: {
            qtyAtOpenMicros: micros(today.qtyAtOpenMicros),
            boughtCents: cents(today.boughtCents),
            soldCents: cents(today.soldCents),
          },
        }
      : {}),
  };
}

function input(overrides: Partial<PortfolioInput> = {}): PortfolioInput {
  return {
    cashCents: START,
    startingCashCents: START,
    holds: [],
    positions: [],
    realizedYtdCents: cents(0),
    equityAtLastCloseCents: START,
    ...overrides,
  };
}

describe('position math', () => {
  it('derives the average cost from the stored basis', () => {
    expect(averageCostTicks({ qtyMicros: shares(3), costBasisCents: cents(30_003) })).toBe(
      1_000_100,
    );
    expect(averageCostTicks({ qtyMicros: shares(3), costBasisCents: cents(10_000) })).toBe(333_333);
  });

  it('has no average cost without shares', () => {
    expect(averageCostTicks({ qtyMicros: micros(0), costBasisCents: cents(0) })).toBe(0);
  });

  it('values a position to the nearest cent', () => {
    expect(marketValueCents(shares(3), ticks(1_000_050))).toBe(30_002);
    expect(marketValueCents(shares(3), ticks(1_000_030))).toBe(30_001);
  });
});

describe('holds', () => {
  it('subtracts buy holds from cash for buying power', () => {
    const holds = [hold({ cents: 5_000 }), hold({ symbol: 'BBB', cents: 2_500 })];

    expect(reservedCents(holds)).toBe(7_500);
    expect(buyingPowerCents(cents(10_000), holds)).toBe(2_500);
  });

  it('subtracts only this symbol’s sell holds from the position', () => {
    const position = { symbol: 'AAA', qtyMicros: shares(10), costBasisCents: cents(100_000) };
    const holds = [
      hold({ side: 'sell', shares: 3 }),
      hold({ side: 'sell', symbol: 'BBB', shares: 2 }),
      hold({ cents: 1_000, shares: 4 }),
    ];

    expect(sellableMicros(position, holds)).toBe(7 * SHARE);
  });

  it('never reports negative sellable shares', () => {
    const position = { symbol: 'AAA', qtyMicros: shares(1), costBasisCents: cents(100) };

    expect(sellableMicros(position, [hold({ side: 'sell', shares: 2 })])).toBe(0);
    expect(sellableMicros(null, [])).toBe(0);
  });
});

describe('summarizePortfolio', () => {
  // $100k start, $20k invested: 100 AAA at $150 (now $160) and 50 XOM at $100 (now $110).
  const invested = input({
    cashCents: cents(8_000_000),
    holds: [hold({ cents: 100_000 })],
    positions: [
      row('XOM', 'Energy', 50, 500_000, 1_100_000, 1_000_000),
      row('AAA', 'Technology', 100, 1_500_000, 1_600_000, 1_550_000),
    ],
    equityAtLastCloseCents: cents(10_050_000),
  });

  it('adds cash and market value into equity', () => {
    const summary = summarizePortfolio(invested);

    expect(summary).toMatchObject({
      equityCents: 10_150_000,
      cashCents: 8_000_000,
      investedCents: 2_150_000,
      reservedCents: 100_000,
      buyingPowerCents: 7_900_000,
      unrealizedCents: 150_000,
    });
  });

  it('measures today against the last close and all-time against starting cash', () => {
    const summary = summarizePortfolio(invested);

    expect(summary).toMatchObject({
      todayCents: 100_000,
      todayBps: 100,
      allTimeCents: 150_000,
      allTimeBps: 150,
    });
  });

  it('summarizes each position, largest first, with its weight', () => {
    const [aaa, xom] = summarizePortfolio(invested).positions;

    expect(aaa).toEqual({
      symbol: 'AAA',
      sector: 'Technology',
      qtyMicros: 100 * SHARE,
      averageCostTicks: 1_500_000,
      lastTicks: 1_600_000,
      marketValueCents: 1_600_000,
      unrealizedCents: 100_000,
      totalReturnBps: 667,
      todayCents: 50_000,
      weightBps: 1_576,
    });
    expect(xom).toMatchObject({ symbol: 'XOM', todayCents: 50_000, weightBps: 542 });
  });

  it('allocates by sector plus cash, sorted largest first', () => {
    expect(summarizePortfolio(invested).allocation).toEqual([
      { key: 'cash', cents: 8_000_000, weightBps: 7_882 },
      { key: 'Technology', cents: 1_600_000, weightBps: 1_576 },
      { key: 'Energy', cents: 550_000, weightBps: 542 },
    ]);
  });

  it('merges a sector and drops empty slices', () => {
    const allIn = input({
      cashCents: cents(0),
      positions: [
        row('AAA', 'Technology', 10, 100_000, 1_000_000, 1_000_000),
        row('BBB', 'Technology', 10, 100_000, 1_000_000, 1_000_000),
        row('DUD', 'Mining', 10, 100_000, 0, 0),
      ],
    });

    expect(summarizePortfolio(allIn).allocation).toEqual([
      { key: 'Technology', cents: 200_000, weightBps: 10_000 },
    ]);
  });

  it('measures a position opened today against what was paid, for an account opened today', () => {
    const opened = input({
      cashCents: cents(START - 155_000),
      positions: [
        row('AAA', 'Technology', 10, 155_000, 1_600_000, 1_500_000, {
          qtyAtOpenMicros: 0,
          boughtCents: 155_000,
          soldCents: 0,
        }),
      ],
      equityAtLastCloseCents: null,
    });

    const summary = summarizePortfolio(opened);

    expect(summary.todayCents).toBe(5_000);
    expect(summary.todayBps).toBe(5);
    expect(summary.allTimeCents).toBe(5_000);
  });

  it('counts today’s trades on top of the shares carried from the last close', () => {
    const mixed = input({
      cashCents: cents(START - 152_000 + 10_400),
      positions: [
        row('AAA', 'Technology', 14, 140_000, 1_050_000, 1_000_000, {
          qtyAtOpenMicros: 10 * SHARE,
          boughtCents: 52_000,
          soldCents: 10_400,
        }),
      ],
      equityAtLastCloseCents: null,
    });

    // 14 × $105 − (10 × $100 + $520 − $104).
    expect(summarizePortfolio(mixed).todayCents).toBe(147_000 - (100_000 + 52_000 - 10_400));
  });

  it('reports a flat empty account', () => {
    const summary = summarizePortfolio(input());

    expect(summary).toMatchObject({
      equityCents: START,
      todayCents: 0,
      allTimeCents: 0,
      positions: [],
      allocation: [{ key: 'cash', cents: START, weightBps: 10_000 }],
    });
  });
});
