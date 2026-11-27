import { DEFAULT_CIRCUIT_BREAKER, ticks } from '@sarwa/domain';

import { CircuitBreaker } from '../../src/trading/circuit-breaker';

const rules = { ...DEFAULT_CIRCUIT_BREAKER, enabled: true };
const T0 = Date.UTC(2026, 11, 1, 15, 0);

describe('CircuitBreaker', () => {
  it('trips with a message when the price moves 10% inside the window', () => {
    const breaker = new CircuitBreaker();
    breaker.check('AAPL', ticks(2_000_000), T0, rules);

    const message = breaker.check('AAPL', ticks(1_790_000), T0 + 60_000, rules);

    expect(message).toBe('Circuit breaker · moved −10.5% in 5 min');
    expect(breaker.tripsToday(T0 + 60_000)).toEqual([{ symbol: 'AAPL', at: T0 + 60_000 }]);
  });

  it('ignores a move that started before the window', () => {
    const breaker = new CircuitBreaker();
    breaker.check('AAPL', ticks(2_000_000), T0, rules);

    const message = breaker.check('AAPL', ticks(1_790_000), T0 + rules.windowMs + 1, rules);

    expect(message).toBeNull();
  });

  it('samples at most once per second', () => {
    const breaker = new CircuitBreaker();
    breaker.check('AAPL', ticks(2_000_000), T0, rules);
    breaker.check('AAPL', ticks(1_850_000), T0 + 500, rules);

    // Had the sub-second 185.00 print been sampled, 204.00 would be +10.3% off the low and trip.
    expect(breaker.check('AAPL', ticks(2_040_000), T0 + 1_000, rules)).toBeNull();
  });

  it('forgets the window of a symbol when it is reset', () => {
    const breaker = new CircuitBreaker();
    breaker.check('AAPL', ticks(2_000_000), T0, rules);

    breaker.reset('AAPL');

    expect(breaker.check('AAPL', ticks(2_400_000), T0 + 1_000, rules)).toBeNull();
  });

  it('never trips when disabled', () => {
    const breaker = new CircuitBreaker();
    const off = { ...rules, enabled: false };
    breaker.check('AAPL', ticks(2_000_000), T0, off);

    expect(breaker.check('AAPL', ticks(1_000_000), T0 + 1_000, off)).toBeNull();
  });
});
