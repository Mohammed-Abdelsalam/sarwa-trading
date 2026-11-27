import { type Route } from 'next';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { type Notification, type NotificationPayload } from '@sarwa/contracts';
import {
  notificationText,
  useMarkAllRead,
  useMarkNotificationRead,
  useNotifications,
} from '@sarwa/core';

import { type Copy, useCopy } from '../../lib/i18n';

export type NotificationTone = 'pos' | 'neg' | 'brand' | 'info' | 'muted';

// Icon tone and destination per kind; the sentence itself comes from core.
export function notificationTarget(payload: NotificationPayload): {
  tone: NotificationTone;
  href: Route;
} {
  switch (payload.kind) {
    case 'order_filled':
    case 'order_partially_filled':
      return { tone: 'pos', href: `/orders?order=${payload.orderId}` as Route };
    case 'order_expired':
    case 'order_canceled':
      return { tone: 'muted', href: `/orders?order=${payload.orderId}` as Route };
    case 'order_rejected':
      return { tone: 'neg', href: `/orders?order=${payload.orderId}` as Route };
    case 'alert_triggered':
      return { tone: 'brand', href: '/alerts' };
    case 'symbol_halted':
      return { tone: 'info', href: `/stocks/${payload.symbol}` as Route };
    case 'market_notice':
      return { tone: 'info', href: '/' };
  }
}

export function notificationRows(items: readonly Notification[], now: number, copy: Copy) {
  const today = new Date(now).toDateString();
  return items.map((item) => ({
    id: item.id,
    ...notificationText(item.payload, copy),
    ...notificationTarget(item.payload),
    when: copy.f.relative(item.createdAt, now),
    unread: item.readAt === null,
    today: new Date(item.createdAt).toDateString() === today,
  }));
}

export type NotificationRow = ReturnType<typeof notificationRows>[number];

export function useNotificationCenter() {
  const copy = useCopy();
  const { t, f, m } = copy;
  const router = useRouter();
  const { items, unreadCount, hasMore, isLoadingMore, loadMore } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllRead();
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const rows = notificationRows(items, now, copy);

  return {
    open,
    unreadCount,
    hasMore,
    isLoadingMore,
    today: rows.filter((row) => row.today),
    earlier: rows.filter((row) => !row.today),
    labels: {
      bell: t.notifications.unreadA11y(f.count(unreadCount)),
      title: t.notifications.title,
      markAllRead: t.notifications.markAllRead,
      today: t.notifications.today,
      earlier: t.notifications.earlier,
      empty: t.notifications.empty,
      unread: t.notifications.unread,
      settings: t.notifications.settings,
      loadMore: m.list.loadMore,
    },
    setOpen: (next: boolean) => {
      if (next) setNow(Date.now());
      setOpen(next);
    },
    loadMore,
    markAllRead: () => {
      markAll.mutate();
    },
    select: (row: NotificationRow) => {
      if (row.unread) markRead.mutate(row.id);
      setOpen(false);
      router.push(row.href);
    },
  };
}
