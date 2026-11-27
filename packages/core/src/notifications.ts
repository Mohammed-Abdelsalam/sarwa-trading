import { type Notification, type NotificationPayload } from '@sarwa/contracts';

import { notificationText } from './copy';
import { type I18n } from './hooks/i18n';

type Copy = Pick<I18n, 't' | 'f' | 'rejection'>;

export type NotificationKind = 'filled' | 'alert' | 'rejected' | 'expired' | 'halted' | 'notice';

// Where tapping a notification leads; each app turns it into its own route.
export type NotificationTarget =
  { kind: 'order'; orderId: string } | { kind: 'alerts' } | { kind: 'stock'; symbol: string };

const KIND: Record<NotificationPayload['kind'], NotificationKind> = {
  order_filled: 'filled',
  order_partially_filled: 'filled',
  order_expired: 'expired',
  order_canceled: 'expired',
  order_rejected: 'rejected',
  alert_triggered: 'alert',
  symbol_halted: 'halted',
  market_notice: 'notice',
};

const HOUR_MS = 60 * 60 * 1000;

export function notificationKind(payload: NotificationPayload): NotificationKind {
  return KIND[payload.kind];
}

export function notificationTarget(payload: NotificationPayload): NotificationTarget | null {
  if ('orderId' in payload) return { kind: 'order', orderId: payload.orderId };
  if (payload.kind === 'alert_triggered') return { kind: 'alerts' };
  if (payload.kind === 'symbol_halted') return { kind: 'stock', symbol: payload.symbol };
  return null;
}

// Within the last hour "2 min ago", earlier today the clock time, before today relative again.
export function notificationRows(items: readonly Notification[], now: number, copy: Copy) {
  const startOfDay = new Date(now).setHours(0, 0, 0, 0);
  return items.map((item) => {
    const today = item.createdAt >= startOfDay;
    return {
      id: item.id,
      kind: notificationKind(item.payload),
      ...notificationText(item.payload, copy),
      target: notificationTarget(item.payload),
      when:
        today && now - item.createdAt >= HOUR_MS
          ? copy.f.time(item.createdAt)
          : copy.f.relative(item.createdAt, now),
      unread: item.readAt === null,
      today,
    };
  });
}

export type NotificationRow = ReturnType<typeof notificationRows>[number];
