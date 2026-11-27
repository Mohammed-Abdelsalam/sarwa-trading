import {
  type InfiniteData,
  type QueryClient,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import { type Notification, type NotificationsResponse } from '@sarwa/contracts';

import { useSarwa } from '../provider';
import { queryKeys } from './keys';

export type Inbox = InfiniteData<NotificationsResponse, string | undefined>;

function updateInbox(queryClient: QueryClient, update: (inbox: Inbox) => Inbox): void {
  queryClient.setQueryData<Inbox>(queryKeys.notifications, (inbox) =>
    inbox && inbox.pages.length > 0 ? update(inbox) : inbox,
  );
}

// The first page carries the unread count; later pages only add older items.
function withFirstPage(
  inbox: Inbox,
  update: (page: NotificationsResponse) => NotificationsResponse,
): Inbox {
  return { ...inbox, pages: inbox.pages.map((page, i) => (i === 0 ? update(page) : page)) };
}

export function prependNotification(queryClient: QueryClient, notification: Notification): void {
  updateInbox(queryClient, (inbox) => {
    if (inbox.pages.some((page) => page.items.some((item) => item.id === notification.id))) {
      return inbox;
    }
    return withFirstPage(inbox, (page) => ({
      ...page,
      items: [notification, ...page.items],
      unreadCount: page.unreadCount + (notification.readAt === null ? 1 : 0),
    }));
  });
}

export function useNotifications() {
  const { api } = useSarwa();
  const query = useInfiniteQuery({
    queryKey: queryKeys.notifications,
    queryFn: ({ signal, pageParam }) => api.listNotifications({ cursor: pageParam }, { signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    staleTime: 30_000,
  });
  const pages = query.data?.pages ?? [];
  return {
    items: pages.flatMap((page) => page.items),
    unreadCount: pages[0]?.unreadCount ?? 0,
    isLoading: query.isPending,
    isError: query.isError && !query.data,
    hasMore: query.hasNextPage,
    isLoadingMore: query.isFetchingNextPage,
    loadMore: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
    },
    refresh: () => void query.refetch(),
  };
}

// Marks one notification read, or all of them for null.
function markRead(inbox: Inbox, id: string | null, now: number): Inbox {
  const matches = (itemId: string) => id === null || itemId === id;
  let marked = 0;
  const pages = inbox.pages.map((page) => ({
    ...page,
    items: page.items.map((item) => {
      if (!matches(item.id) || item.readAt !== null) return item;
      marked += 1;
      return { ...item, readAt: now };
    }),
  }));
  return withFirstPage({ ...inbox, pages }, (page) => ({
    ...page,
    unreadCount: id === null ? 0 : Math.max(0, page.unreadCount - marked),
  }));
}

// Read state is low-stakes, so it is optimistic and rolls back if the request fails.
function useReadMutation() {
  const { api } = useSarwa();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string | null) =>
      id === null ? api.markAllNotificationsRead() : api.markNotificationRead(id),
    onMutate: async (id: string | null) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications });
      const previous = queryClient.getQueryData<Inbox>(queryKeys.notifications);
      updateInbox(queryClient, (inbox) => markRead(inbox, id, Date.now()));
      return { previous };
    },
    onError: (_error, _id, context) => {
      queryClient.setQueryData(queryKeys.notifications, context?.previous);
    },
  });
}

export function useMarkNotificationRead() {
  const mutation = useReadMutation();
  return {
    ...mutation,
    mutate: (id: string) => {
      mutation.mutate(id);
    },
  };
}

export function useMarkAllRead() {
  const { analytics } = useSarwa();
  const queryClient = useQueryClient();
  const mutation = useReadMutation();
  return {
    ...mutation,
    mutate: () => {
      const inbox = queryClient.getQueryData<Inbox>(queryKeys.notifications);
      analytics.track({ name: 'notifications_read', count: inbox?.pages[0]?.unreadCount ?? 0 });
      mutation.mutate(null);
    },
  };
}
