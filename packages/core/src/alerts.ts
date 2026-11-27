import { type Alert, type CreateAlertRequest, type Quote } from '@sarwa/contracts';
import { absolute, changeBps, parseTicks, ticks } from '@sarwa/domain';

import { type I18n } from './hooks/i18n';
import { parseMoveBps, toTradeQuote } from './trading';

type Copy = Pick<I18n, 't' | 'f'>;

export type AlertState = 'active' | 'paused' | 'triggered';

export interface AlertForm {
  symbol: string;
  condition: Alert['condition'];
  target: string;
  repeat: Alert['repeat'];
}

export function alertState(alert: Pick<Alert, 'enabled' | 'armed' | 'lastFiredAt'>): AlertState {
  if (!alert.enabled) return 'paused';
  return !alert.armed && alert.lastFiredAt !== null ? 'triggered' : 'active';
}

// When it fired, or how far the market is from the alert right now.
export function alertDetail(alert: Alert, quote: Quote | undefined, { t, f }: Copy): string {
  if (alertState(alert) === 'triggered' && alert.lastFiredAt !== null) {
    return t.alerts.triggeredAt({
      time: f.time(alert.lastFiredAt),
      price: alert.thresholdTicks === null ? '—' : f.price(ticks(alert.thresholdTicks)),
    });
  }
  if (!quote) return '';
  const { lastTicks, prevCloseTicks } = toTradeQuote(quote);
  if (alert.condition === 'move_today') {
    return t.alerts.todayMove({
      pct: f.percent(changeBps(prevCloseTicks, lastTicks), { signed: true }),
    });
  }
  if (alert.thresholdTicks === null) return '';
  return t.alerts.away({
    price: f.price(lastTicks),
    pct: f.percent(absolute(changeBps(lastTicks, alert.thresholdTicks))),
  });
}

// The typed target as the request the API takes, or null when it isn't a usable number.
export function alertRequest({
  symbol,
  condition,
  target,
  repeat,
}: AlertForm): CreateAlertRequest | null {
  if (!symbol) return null;
  if (condition === 'move_today') {
    const moveBps = parseMoveBps(target);
    return moveBps === null ? null : { symbol, condition, repeat, thresholdBps: moveBps };
  }
  const price = parseTicks(target);
  return price === null || price <= 0 ? null : { symbol, condition, repeat, thresholdTicks: price };
}

export function alertTargetHint(
  request: CreateAlertRequest | null,
  lastTicks: number | null,
  { t, f }: Copy,
): string | undefined {
  if (request?.thresholdTicks === undefined || lastTicks === null) return undefined;
  const move = changeBps(lastTicks, request.thresholdTicks);
  if (move === 0) return undefined;
  const pct = f.percent(absolute(move));
  return move > 0 ? t.alerts.aboveCurrent({ pct }) : t.alerts.belowCurrent({ pct });
}
