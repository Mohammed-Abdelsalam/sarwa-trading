import { bps, type Bps, type Cents, dollarsToCents } from './money';

// Admin-editable execution rules (Admin → Trading). Every client reads the same values.
export interface ExecutionRules {
  spreadBps: Bps;
  maxSlippageBps: Bps;
  collarBps: Bps;
  staleQuoteMs: number;
  minNotionalCents: Cents;
  maxNotionalCents: Cents;
  closedMarketBufferBps: Bps;
  queueWhenClosed: boolean;
}

export const DEFAULT_EXECUTION_RULES: ExecutionRules = {
  spreadBps: bps(2),
  maxSlippageBps: bps(5),
  collarBps: bps(1_000),
  staleQuoteMs: 5_000,
  minNotionalCents: dollarsToCents(1),
  maxNotionalCents: dollarsToCents(250_000),
  closedMarketBufferBps: bps(500),
  queueWhenClosed: true,
};

export interface CircuitBreakerRules {
  enabled: boolean;
  moveBps: Bps;
  windowMs: number;
  haltMs: number;
}

export const DEFAULT_CIRCUIT_BREAKER: CircuitBreakerRules = {
  enabled: true,
  moveBps: bps(1_000),
  windowMs: 5 * 60_000,
  haltMs: 10 * 60_000,
};

// Product policy: fixed in code because changing it would rewrite history (e.g. the starting cash).
export const POLICY = {
  startingCashCents: dollarsToCents(100_000),
  largeOrderEquityBps: bps(2_500),
  gtcDays: 90,
  quoteValidityMs: 10_000,
  maxActiveAlerts: 50,
  alertCooldownMs: 15 * 60_000,
  snapshotIntervalMs: 5 * 60_000,
} as const;
