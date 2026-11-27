import { DEFAULT_CIRCUIT_BREAKER, DEFAULT_EXECUTION_RULES, POLICY } from '../src/rules';

describe('policy and defaults', () => {
  it('starts every account with $100,000', () => {
    expect(POLICY.startingCashCents).toBe(10_000_000);
  });

  it('confirms orders above 25% of equity and keeps GTC for 90 days', () => {
    expect(POLICY.largeOrderEquityBps).toBe(2_500);
    expect(POLICY.gtcDays).toBe(90);
  });

  it('keeps the closed-market buffer at least as large as the slippage cap', () => {
    const { closedMarketBufferBps, maxSlippageBps } = DEFAULT_EXECUTION_RULES;

    expect(closedMarketBufferBps).toBeGreaterThanOrEqual(maxSlippageBps);
  });

  it('enables the circuit breaker by default', () => {
    expect(DEFAULT_CIRCUIT_BREAKER.enabled).toBe(true);
  });
});
