import { type Bps, type Cents } from './money';

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
  spreadBps: 2,
  maxSlippageBps: 5,
  collarBps: 1_000,
  staleQuoteMs: 5_000,
  minNotionalCents: 100,
  maxNotionalCents: 25_000_000,
  closedMarketBufferBps: 500,
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
  moveBps: 1_000,
  windowMs: 5 * 60_000,
  haltMs: 10 * 60_000,
};

// Product policy: fixed in code because changing it would rewrite history (e.g. the starting cash).
export const POLICY = {
  startingCashCents: 10_000_000,
  largeOrderEquityBps: 2_500,
  gtcDays: 90,
  quoteValidityMs: 10_000,
  maxActiveAlerts: 50,
  alertCooldownMs: 15 * 60_000,
  snapshotIntervalMs: 5 * 60_000,
} as const;
