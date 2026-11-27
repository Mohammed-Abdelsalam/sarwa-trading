import { router } from 'expo-router';

import { useMarkAllRead, useMarkNotificationRead, useNotifications } from '@sarwa/core';

import { useNow } from '../../lib/clock';
import { useCopy } from '../../lib/i18n';
import { groupNotifications, type NotificationLine } from './notification-copy';

export function useNotificationsScreen() {
  const copy = useCopy();
  const notifications = useNotifications();
  const markAll = useMarkAllRead();
  const markOne = useMarkNotificationRead();
  const now = useNow();

  return {
    groups: groupNotifications(notifications.items, copy, now),
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
