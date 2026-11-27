import { RateLimitedException, RateLimiter } from '../../src/common/rate-limiter';
import { FakeClock } from '../app';

describe('RateLimiter', () => {
  const clock = new FakeClock(1_000_000);
  const limiter = new RateLimiter(clock);
  const retryAfter = (fn: () => void): number => {
    try {
      fn();
    } catch (error) {
      if (error instanceof RateLimitedException) {
        return (error.getResponse() as { retryAfterSeconds: number }).retryAfterSeconds;
      }
      throw error;
    }
    return 0;
  };

  it('allows the limit within a window, then refuses until the oldest use leaves it', () => {
    for (let i = 0; i < 3; i++) limiter.consume('forgot:a@x.dev', 3, 60_000);
    clock.advance(20_000);

    expect(retryAfter(() => limiter.consume('forgot:a@x.dev', 3, 60_000))).toBe(40);
    clock.advance(40_000);
    expect(retryAfter(() => limiter.consume('forgot:a@x.dev', 3, 60_000))).toBe(0);
  });

  it('can check a key without counting, for limits that only count failures', () => {
    limiter.assertAllowed('ip:1', 1, 60_000);
    limiter.assertAllowed('ip:1', 1, 60_000);
    limiter.record('ip:1', 60_000);

    expect(retryAfter(() => limiter.assertAllowed('ip:1', 1, 60_000))).toBe(60);
  });

  it('keeps keys apart', () => {
    limiter.consume('k1', 1, 60_000);

    expect(retryAfter(() => limiter.consume('k2', 1, 60_000))).toBe(0);
  });
});
