import { bps, ticks } from '../src/money';
import { isQuoteStale, quoteAgeMs, spreadAround } from '../src/quote';
import { DEFAULT_EXECUTION_RULES } from '../src/rules';

describe('spreadAround', () => {
  it('puts half the spread on each side of the last trade', () => {
    expect(spreadAround(ticks(1_000_000), bps(2))).toEqual({
      bidTicks: 999_900,
      askTicks: 1_000_100,
    });
  });

  it('splits an odd spread exactly in half', () => {
    expect(spreadAround(ticks(1_000_000), bps(3))).toEqual({
      bidTicks: 999_850,
      askTicks: 1_000_150,
    });
  });

  it('rounds the bid down and the ask up so the spread never shrinks', () => {
    const last = ticks(1_000_001);

    const { bidTicks, askTicks } = spreadAround(last, bps(3));

    expect(bidTicks).toBe(999_850);
    expect(askTicks).toBe(1_000_152);
    expect((askTicks - bidTicks) * 10_000).toBeGreaterThanOrEqual(last * 3);
  });

  it('collapses to the last trade when there is no spread', () => {
    expect(spreadAround(ticks(1_234_567), bps(0))).toEqual({
      bidTicks: 1_234_567,
      askTicks: 1_234_567,
    });
  });
});

describe('quote age', () => {
  it('measures the age from the quote time', () => {
    expect(quoteAgeMs({ ts: 1_000 }, 4_500)).toBe(3_500);
  });

  it('never reports a negative age for a quote stamped ahead of the clock', () => {
    expect(quoteAgeMs({ ts: 5_000 }, 4_000)).toBe(0);
  });

  it('is stale only once older than the limit', () => {
    const rules = DEFAULT_EXECUTION_RULES;

    expect(isQuoteStale({ ts: 0 }, rules.staleQuoteMs, rules)).toBe(false);
    expect(isQuoteStale({ ts: 0 }, rules.staleQuoteMs + 1, rules)).toBe(true);
  });
});
