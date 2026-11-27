import { router } from 'expo-router';

import { useMarkAllRead, useMarkNotificationRead, useNotifications, useNow } from '@sarwa/core';

import { useCopy } from '../../lib/i18n';
import { groupNotifications, type NotificationLine } from './notification-copy';

// One flat list for FlashList: each day header is an item of its own type.
export type NotificationItem =
  | { type: 'header'; key: string; title: string }
  | { type: 'row'; key: string; line: NotificationLine };

export function useNotificationsScreen() {
  const copy = useCopy();
  const notifications = useNotifications();
  const markAll = useMarkAllRead();
  const markOne = useMarkNotificationRead();
  const now = useNow();

  return {
    items: groupNotifications(notifications.items, copy, now).flatMap((group) => [
      { type: 'header', key: group.key, title: group.title } satisfies NotificationItem,
      ...group.items.map(
        (line) => ({ type: 'row', key: line.id, line }) satisfies NotificationItem,
      ),
    ]),
    unreadCount: notifications.unreadCount,
    isLoading: notifications.isLoading,
    isError: notifications.isError,
    isLoadingMore: notifications.isLoadingMore,
    actions: {
      retry: notifications.refresh,
      loadMore: notifications.loadMore,
      markAllRead: () => {
        markAll.mutate();
      },
      open: (line: NotificationLine) => {
        if (line.unread) markOne.mutate(line.id);
        if (line.href) router.push(line.href);
      },
    },
  };
}
