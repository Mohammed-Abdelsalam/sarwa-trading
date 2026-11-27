import { type Alert, type NotificationPayload, type TradingStatus } from '@sarwa/contracts';
import { bps, cents, micros, ticks } from '@sarwa/domain';
import { createFormatter, type Digits, DIGITS, LOCALES } from '@sarwa/i18n';

import { type I18n } from './hooks/i18n';
import { type LiveStatus } from './status';

type Copy = Pick<I18n, 't' | 'f'>;

export type MarketState = 'open' | 'closed' | 'pre' | 'post' | 'halted' | 'reconnecting';

export interface MarketPill {
  state: MarketState;
  label: string;
  short: string;
}

export interface NotificationText {
  title: string;
  body: string;
}

const DIGIT_SAMPLE = 123;

export function alertRuleText(
  rule: Pick<Alert, 'condition' | 'thresholdTicks' | 'thresholdBps'>,
  { t, f }: Copy,
): string {
  if (rule.condition === 'move_today') {
    const move = bps(rule.thresholdBps ?? 0);
    const pct = f.percent(move, { signed: true });
    return move < 0 ? t.alerts.moveAtMost({ pct }) : t.alerts.moveAtLeast({ pct });
  }
  const price = f.price(ticks(rule.thresholdTicks ?? 0));
  return rule.condition === 'price_above'
    ? t.alerts.priceAbove({ price })
    : t.alerts.priceBelow({ price });
}

// Notifications carry data, not sentences: every surface renders them here in the reader's language.
export function notificationText(
  payload: NotificationPayload,
  copy: Pick<I18n, 't' | 'f' | 'rejection'>,
): NotificationText {
  const { t, f } = copy;
  switch (payload.kind) {
    case 'order_filled':
    case 'order_partially_filled': {
      const fill = {
        shares: f.shares(micros(payload.qtyMicros)),
        symbol: payload.symbol,
        amount: f.money(cents(payload.notionalCents)),
      };
      return {
        title:
          payload.kind === 'order_filled'
            ? t.notifications.orderFilled
            : t.notifications.orderPartiallyFilled,
        body:
          payload.side === 'buy'
            ? t.notifications.boughtBody(fill)
            : t.notifications.soldBody(fill),
      };
    }
    case 'order_expired':
    case 'order_canceled': {
      const order = t.notifications.orderLabel({
        side: t.common[payload.side],
        symbol: payload.symbol,
      });
      return payload.kind === 'order_expired'
        ? { title: t.notifications.orderExpired, body: t.notifications.orderExpiredBody({ order }) }
        : {
            title: t.notifications.orderCanceled,
            body: t.notifications.orderCanceledBody({ order }),
          };
    }
    case 'order_rejected':
      return {
        title: t.notifications.orderRejected,
        body: t.notifications.orderRejectedBody({
          order: t.notifications.orderLabel({
            side: t.common[payload.side],
            symbol: payload.symbol,
          }),
          reason: copy.rejection(payload.rejection, payload.symbol).reason,
        }),
      };
    case 'alert_triggered': {
      const price = f.price(ticks(payload.lastTicks));
      return {
        title: t.notifications.alertTriggered({
          symbol: payload.symbol,
          price: payload.thresholdTicks === null ? price : f.price(ticks(payload.thresholdTicks)),
        }),
        body: t.notifications.alertTriggeredBody({ rule: alertRuleText(payload, copy), price }),
      };
    }
    case 'symbol_halted':
      return {
        title: t.notifications.symbolHalted({ symbol: payload.symbol }),
        body:
          payload.resumesAt === null
            ? payload.message
            : `${payload.message} · ${t.market.resumesAt({ time: f.time(payload.resumesAt) })}`,
      };
    case 'market_notice':
      return { title: t.notifications.marketNotice, body: payload.message };
  }
}

// A dropped connection wins over the session: the prices on screen may be behind.
export function marketPill(
  live: LiveStatus,
  session: TradingStatus['session'] | undefined,
  { t, f }: Copy,
): MarketPill {
  const states = t.market.states;
  const same = (state: MarketState, label: string): MarketPill => ({ state, label, short: label });
  if (live === 'offline') return same('closed', states.offline);
  if (live === 'reconnecting') return same('reconnecting', states.reconnecting);
  if (live === 'connecting') return same('reconnecting', states.connecting);
  if (live === 'paused') return same('halted', states.paused);
  if (!session) return same('open', t.common.live);
  switch (session.phase) {
    case 'regular': {
      const time = f.time(session.closesAt);
      const label = session.earlyClose ? t.market.earlyClose({ time }) : t.market.open({ time });
      return { state: 'open', label, short: t.common.live };
    }
    case 'pre':
      return {
        state: 'pre',
        label: t.market.preMarket({ time: f.time(session.opensAt) }),
        short: states.pre,
      };
    case 'post':
      return { state: 'post', label: t.market.afterHours, short: states.post };
    case 'closed':
      return {
        state: 'closed',
        label: t.market.closed({ time: f.dateTime(session.opensAt) }),
        short: states.closed,
      };
  }
}

export function languageOptions({ t }: Pick<I18n, 't'>) {
  return LOCALES.map((value) => ({ value, label: t.settings.languages[value] }));
}

// Each option shows a sample in its own digits, so the choice is visible before it is made.
export function digitOptions({ t, locale }: Pick<I18n, 't' | 'locale'>) {
  return DIGITS.map((value: Digits) => ({
    value,
    label: t.settings.digitOptions[value]({
      sample: createFormatter({ locale, digits: value }).number(DIGIT_SAMPLE),
    }),
  }));
}
