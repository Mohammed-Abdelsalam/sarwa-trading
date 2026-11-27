import { type Notification, type NotificationPayload } from '@sarwa/contracts';
import { notificationText } from '@sarwa/core';

import { type Copy } from '../../lib/i18n';

export type NotificationKind = 'filled' | 'alert' | 'rejected' | 'expired' | 'halted' | 'notice';

export interface NotificationLine {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  when: string;
  unread: boolean;
  href: { pathname: '/orders/[id]'; params: { id: string } } | { pathname: '/alerts' } | null;
}

export interface NotificationGroup {
  key: 'today' | 'earlier';
  title: string;
  items: NotificationLine[];
}

const HOUR_MS = 60 * 60 * 1000;

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

function href(payload: NotificationPayload): NotificationLine['href'] {
  if ('orderId' in payload) return { pathname: '/orders/[id]', params: { id: payload.orderId } };
  return payload.kind === 'alert_triggered' ? { pathname: '/alerts' } : null;
}

function content(
  payload: NotificationPayload,
  copy: Copy,
): Omit<NotificationLine, 'id' | 'when' | 'unread'> {
  return { kind: KIND[payload.kind], ...notificationText(payload, copy), href: href(payload) };
}

function when(ms: number, now: number, { f }: Copy) {
  return now - ms < HOUR_MS ? f.relative(ms, now) : f.time(ms);
}

export function groupNotifications(
  items: readonly Notification[],
  copy: Copy,
  now: number,
): NotificationGroup[] {
  const startOfDay = new Date(now).setHours(0, 0, 0, 0);
  const line = (item: Notification): NotificationLine => ({
    id: item.id,
    unread: item.readAt === null,
    when:
      item.createdAt >= startOfDay
        ? when(item.createdAt, now, copy)
        : copy.f.relative(item.createdAt, now),
    ...content(item.payload, copy),
  });
  const groups: NotificationGroup[] = [
    {
      key: 'today',
      title: copy.t.notifications.today,
      items: items.filter((i) => i.createdAt >= startOfDay).map(line),
    },
    {
      key: 'earlier',
      title: copy.t.notifications.earlier,
      items: items.filter((i) => i.createdAt < startOfDay).map(line),
    },
  ];
  return groups.filter((group) => group.items.length > 0);
}
