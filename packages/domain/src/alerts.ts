import { type Bps, changeBps, type Ticks } from './money';
import { type TradeQuote } from './quote';
import { POLICY } from './rules';

export const ALERT_CONDITIONS = ['price_above', 'price_below', 'move_today'] as const;
export type AlertCondition = (typeof ALERT_CONDITIONS)[number];

export const ALERT_REPEATS = ['once', 'every'] as const;
export type AlertRepeat = (typeof ALERT_REPEATS)[number];

// `move_today` uses a signed threshold: +500 fires at ≥ +5% on the day, −500 at ≤ −5%.
export interface AlertRule {
  condition: AlertCondition;
  thresholdTicks: Ticks | null;
  thresholdBps: Bps | null;
}

export interface AlertState {
  repeat: AlertRepeat;
  // Waiting for the condition to become true; it fires on that crossing, never while it stays true.
  armed: boolean;
  lastFiredAt: number | null;
}

export const ALERT_ISSUE_CODES = [
  'ALREADY_ABOVE',
  'ALREADY_BELOW',
  'ALREADY_MOVED',
  'MISSING_THRESHOLD',
] as const;

export type AlertIssue =
  | { code: 'ALREADY_ABOVE' | 'ALREADY_BELOW'; lastTicks: Ticks }
  | { code: 'ALREADY_MOVED'; moveBps: Bps }
  | { code: 'MISSING_THRESHOLD' };

export function moveTodayBps(quote: Pick<TradeQuote, 'lastTicks' | 'prevCloseTicks'>): Bps {
  return changeBps(quote.prevCloseTicks, quote.lastTicks);
}

export function isAlertMet(
  rule: AlertRule,
  quote: Pick<TradeQuote, 'lastTicks' | 'prevCloseTicks'>,
) {
  if (rule.condition === 'price_above')
    return rule.thresholdTicks !== null && quote.lastTicks >= rule.thresholdTicks;
  if (rule.condition === 'price_below')
    return rule.thresholdTicks !== null && quote.lastTicks <= rule.thresholdTicks;
  if (rule.thresholdBps === null || rule.thresholdBps === 0) return false;
  const move = moveTodayBps(quote);
  return rule.thresholdBps > 0 ? move >= rule.thresholdBps : move <= rule.thresholdBps;
}

// An alert that is already true would fire the instant it is saved, which is never what was meant.
export function validateAlert(
  rule: AlertRule,
  quote: Pick<TradeQuote, 'lastTicks' | 'prevCloseTicks'>,
): AlertIssue | null {
  const threshold = rule.condition === 'move_today' ? rule.thresholdBps : rule.thresholdTicks;
  if (threshold === null || threshold === 0) return { code: 'MISSING_THRESHOLD' };
  if (!isAlertMet(rule, quote)) return null;
  if (rule.condition === 'price_above')
    return { code: 'ALREADY_ABOVE', lastTicks: quote.lastTicks };
  if (rule.condition === 'price_below')
    return { code: 'ALREADY_BELOW', lastTicks: quote.lastTicks };
  return { code: 'ALREADY_MOVED', moveBps: moveTodayBps(quote) };
}

// Fires on the crossing. "Every time" re-arms only after the price has crossed back AND the cooldown
// has passed, so a price hovering at the threshold can't spam notifications.
export function evaluateAlert(
  rule: AlertRule,
  state: AlertState,
  quote: Pick<TradeQuote, 'lastTicks' | 'prevCloseTicks'>,
  now: number,
): { fire: boolean; state: AlertState } {
  const met = isAlertMet(rule, quote);
  if (state.armed && met)
    return { fire: true, state: { ...state, armed: false, lastFiredAt: now } };
  const cooled = state.lastFiredAt === null || now - state.lastFiredAt >= POLICY.alertCooldownMs;
  if (!state.armed && !met && state.repeat === 'every' && cooled) {
    return { fire: false, state: { ...state, armed: true } };
  }
  return { fire: false, state };
}
