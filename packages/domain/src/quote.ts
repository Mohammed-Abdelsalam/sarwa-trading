import { type Bps, BPS_PER_UNIT, divide, type Micros, ticks, type Ticks } from './money';
import { type ExecutionRules } from './rules';

export interface TradeQuote {
  lastTicks: Ticks;
  bidTicks: Ticks;
  askTicks: Ticks;
  prevCloseTicks: Ticks;
  // Shares shown at the bid and ask; limit orders fill against this displayed size.
  bidSizeMicros: Micros;
  askSizeMicros: Micros;
  ts: number;
}

// Half the spread on each side of the last trade; the bid rounds down and the ask up, so the
// quoted spread never shrinks below the configured one.
export function spreadAround(
  lastTicks: Ticks,
  spreadBps: Bps,
): { bidTicks: Ticks; askTicks: Ticks } {
  // Over 2 × 10,000 so an odd spread (e.g. 3 bps) still splits exactly in half.
  const scale = 2n * BigInt(BPS_PER_UNIT);
  const last = BigInt(lastTicks);
  const spread = BigInt(spreadBps);
  return {
    bidTicks: ticks(divide(last * (scale - spread), scale, 'down')),
    askTicks: ticks(divide(last * (scale + spread), scale, 'up')),
  };
}

export function quoteAgeMs(quote: Pick<TradeQuote, 'ts'>, now: number): number {
  return Math.max(0, now - quote.ts);
}

export function isQuoteStale(
  quote: Pick<TradeQuote, 'ts'>,
  now: number,
  rules: Pick<ExecutionRules, 'staleQuoteMs'>,
): boolean {
  return quoteAgeMs(quote, now) > rules.staleQuoteMs;
}
