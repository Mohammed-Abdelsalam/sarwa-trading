import { type Notification } from '@sarwa/contracts';
import { notificationRows, type NotificationTarget } from '@sarwa/core';

import { type Copy } from '../../lib/i18n';

export type { NotificationKind } from '@sarwa/core';

type Href =
  | { pathname: '/orders/[id]'; params: { id: string } }
  | { pathname: '/stocks/[symbol]'; params: { symbol: string } }
  | { pathname: '/alerts' };

export type NotificationLine = Omit<
  ReturnType<typeof notificationRows>[number],
  'target' | 'today'
> & {
  href: Href | null;
};

export interface NotificationGroup {
  key: 'today' | 'earlier';
  title: string;
  items: NotificationLine[];
}

function href(target: NotificationTarget | null): Href | null {
  if (target === null) return null;
  if (target.kind === 'order') return { pathname: '/orders/[id]', params: { id: target.orderId } };
  if (target.kind === 'stock')
    return { pathname: '/stocks/[symbol]', params: { symbol: target.symbol } };
  return { pathname: '/alerts' };
}

export function groupNotifications(
  items: readonly Notification[],
  copy: Copy,
  now: number,
): NotificationGroup[] {
  const rows = notificationRows(items, now, copy).map(({ target, today, ...row }) => ({
    today,
    line: { ...row, href: href(target) },
  }));
  const groups: NotificationGroup[] = [
    {
      key: 'today',
      title: copy.t.notifications.today,
      items: rows.filter((row) => row.today).map((row) => row.line),
    },
    {
      key: 'earlier',
      title: copy.t.notifications.earlier,
      items: rows.filter((row) => !row.today).map((row) => row.line),
    },
  ];
  return groups.filter((group) => group.items.length > 0);
}
