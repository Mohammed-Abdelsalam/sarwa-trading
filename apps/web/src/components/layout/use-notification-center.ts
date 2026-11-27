import { type Route } from 'next';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { type Notification, type NotificationPayload } from '@sarwa/contracts';
import {
  notificationKind,
  type NotificationKind,
  notificationRows as sharedRows,
  notificationTarget as sharedTarget,
  type NotificationTarget,
  useGate,
  useMarkAllRead,
  useMarkNotificationRead,
  useNotifications,
  useSession,
} from '@sarwa/core';

import { type Copy, useCopy } from '../../lib/i18n';

export type NotificationTone = 'pos' | 'neg' | 'brand' | 'info' | 'muted';

const TONE: Record<NotificationKind, NotificationTone> = {
  filled: 'pos',
  expired: 'muted',
  rejected: 'neg',
  alert: 'brand',
  halted: 'info',
  notice: 'info',
};

function href(target: NotificationTarget | null): Route {
  if (target === null) return '/';
  if (target.kind === 'order') return `/orders?order=${target.orderId}` as Route;
  if (target.kind === 'stock') return `/stocks/${target.symbol}` as Route;
  return '/alerts';
}

// Icon tone and destination per kind; the sentence itself comes from core.
export function notificationTarget(payload: NotificationPayload) {
  return { tone: TONE[notificationKind(payload)], href: href(sharedTarget(payload)) };
}

export function notificationRows(
  items: readonly Notification[],
  now: number,
  copy: Copy,
  reader?: { name: string },
) {
  return sharedRows(items, now, copy, reader).map(({ kind, target, ...row }) => ({
    ...row,
    tone: TONE[kind],
    href: href(target),
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
  const { user } = useSession();
  const { resumed, consume } = useGate();
  const [manualOpen, setManualOpen] = useState(false);
  // A guest who signed in from the bell lands with the inbox open, until they close it.
  const resumedHere = resumed?.kind === 'notifications';
  const open = manualOpen || resumedHere;
  const [now, setNow] = useState(() => Date.now());
  const rows = notificationRows(items, now, copy, user ?? undefined);
  const setOpen = (next: boolean) => {
    if (next) setNow(Date.now());
    else if (resumedHere) consume();
    setManualOpen(next);
  };

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
    setOpen,
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
