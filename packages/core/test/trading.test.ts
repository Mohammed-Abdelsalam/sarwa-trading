import { ticks } from '@sarwa/domain';

import { orderFill, parseMoveBps, spreadBps } from '../src/trading';
import { makeFilledOrder } from './trading-fixtures';

describe('spreadBps', () => {
  it('measures the spread against the mid price', () => {
    expect(spreadBps({ bidTicks: ticks(10_000), askTicks: ticks(30_000) })).toBe(10_000);
    expect(spreadBps({ bidTicks: ticks(2_314_600), askTicks: ticks(2_315_000) })).toBe(2);
  });
});

describe('orderFill', () => {
  it('gives the slippage per share in cents, positive when worse for the trader', () => {
    expect(
      orderFill(makeFilledOrder({ side: 'buy', quotedTicks: 1_000_000, avgFillTicks: 1_000_200 })),
    ).toEqual({ avgFillTicks: 1_000_200, slippageBps: 2, slippageCents: 2 });
    expect(
      orderFill(makeFilledOrder({ side: 'sell', quotedTicks: 1_000_000, avgFillTicks: 1_000_200 })),
    ).toMatchObject({ slippageBps: -2, slippageCents: -2 });
  });

  it('has no fill figures before anything fills', () => {
    expect(orderFill(makeFilledOrder({ filledMicros: 0 }))).toEqual({
      avgFillTicks: null,
      slippageBps: null,
      slippageCents: null,
    });
  });
});

describe('parseMoveBps', () => {
  it('reads up and down moves as signed basis points', () => {
    expect(parseMoveBps('5.25')).toBe(525);
    expect(parseMoveBps('+5')).toBe(500);
    expect(parseMoveBps('-5.25')).toBe(-525);
    expect(parseMoveBps('−3')).toBe(-300);
  });

  it('rejects zero and text that is not a percent', () => {
    expect(parseMoveBps('0')).toBeNull();
    expect(parseMoveBps('-')).toBeNull();
    expect(parseMoveBps('5.255')).toBeNull();
    expect(parseMoveBps('-0')).toBeNull();
  });

  it('caps a move at 100% either way', () => {
    expect(parseMoveBps('100')).toBe(10_000);
    expect(parseMoveBps('-100')).toBe(-10_000);
    expect(parseMoveBps('150')).toBeNull();
    expect(parseMoveBps('-100.01')).toBeNull();
  });
});
