import { act, renderHook, waitFor } from '@testing-library/react';

import { type NotificationsResponse } from '@sarwa/contracts';

import { useMarkAllRead, useMarkNotificationRead, useNotifications } from '../../src/hooks';
import { makeNotification } from '../trading-fixtures';
import { createTestClient, createWrapper, makeProblem } from '../utils';

const INBOX: NotificationsResponse = {
  items: [makeNotification({ id: 'a' }), makeNotification({ id: 'b' })],
  nextCursor: null,
  unreadCount: 2,
};

// A tiny server: reads stick, so the refetch after a read returns what the server now holds.
function setup(api: Parameters<typeof createTestClient>[0]) {
  const read = new Set<string>();
  const client = createTestClient({
    listNotifications: () => {
      const items = INBOX.items.map((item) => (read.has(item.id) ? { ...item, readAt: 1 } : item));
      const unreadCount = items.filter((item) => item.readAt === null).length;
      return Promise.resolve({ ...INBOX, items, unreadCount });
    },
    markNotificationRead: (id) => {
      read.add(id);
      return Promise.resolve();
    },
    markAllNotificationsRead: () => {
      INBOX.items.forEach((item) => read.add(item.id));
      return Promise.resolve();
    },
    ...api,
  });
  const { Wrapper } = createWrapper(client);
  return { client, Wrapper };
}

describe('notifications', () => {
  it('marks everything read at once and tracks how many were unread', async () => {
    const { client, Wrapper } = setup({});
    const { result } = renderHook(
      () => ({ inbox: useNotifications(), readAll: useMarkAllRead() }),
      {
        wrapper: Wrapper,
      },
    );
    await waitFor(() => {
      expect(result.current.inbox.unreadCount).toBe(2);
    });

    act(() => {
      result.current.readAll.mutate();
    });

    await waitFor(() => {
      expect(result.current.inbox.unreadCount).toBe(0);
    });
    expect(result.current.inbox.items.every((item) => item.readAt !== null)).toBe(true);
    expect(client.analytics.track).toHaveBeenCalledWith({ name: 'notifications_read', count: 2 });
  });

  it('rolls back when marking everything read fails', async () => {
    const { Wrapper } = setup({ markAllNotificationsRead: () => Promise.reject(makeProblem(500)) });
    const { result } = renderHook(
      () => ({ inbox: useNotifications(), readAll: useMarkAllRead() }),
      {
        wrapper: Wrapper,
      },
    );
    await waitFor(() => {
      expect(result.current.inbox.unreadCount).toBe(2);
    });

    act(() => {
      result.current.readAll.mutate();
    });

    await waitFor(() => {
      expect(result.current.readAll.isError).toBe(true);
    });
    expect(result.current.inbox.unreadCount).toBe(2);
  });

  it('refetches the inbox after a read settles, so the rollback cannot drop newer items', async () => {
    const listNotifications = jest.fn(() => Promise.resolve(INBOX));
    const { Wrapper } = setup({
      listNotifications,
      markNotificationRead: () => Promise.reject(makeProblem(500)),
    });
    const { result } = renderHook(
      () => ({ inbox: useNotifications(), read: useMarkNotificationRead() }),
      { wrapper: Wrapper },
    );
    await waitFor(() => {
      expect(result.current.inbox.unreadCount).toBe(2);
    });

    act(() => {
      result.current.read.mutate('a');
    });

    await waitFor(() => {
      expect(listNotifications).toHaveBeenCalledTimes(2);
    });
  });

  it('marks one notification read and lowers the unread count once', async () => {
    const { Wrapper } = setup({});
    const { result } = renderHook(
      () => ({ inbox: useNotifications(), read: useMarkNotificationRead() }),
      { wrapper: Wrapper },
    );
    await waitFor(() => {
      expect(result.current.inbox.unreadCount).toBe(2);
    });

    act(() => {
      result.current.read.mutate('a');
    });
    await waitFor(() => {
      expect(result.current.read.isSuccess).toBe(true);
    });
    act(() => {
      result.current.read.mutate('a');
    });

    await waitFor(() => {
      expect(result.current.inbox.unreadCount).toBe(1);
    });
    expect(result.current.inbox.items.find((item) => item.id === 'a')?.readAt).not.toBeNull();
  });

  it('loads older pages by cursor and marks every loaded page read', async () => {
    const listNotifications = jest.fn((query?: { cursor?: string }) =>
      Promise.resolve<NotificationsResponse>(
        query?.cursor === 'b'
          ? { items: [makeNotification({ id: 'c' })], nextCursor: null, unreadCount: 3 }
          : { ...INBOX, nextCursor: 'b', unreadCount: 3 },
      ),
    );
    const { Wrapper } = setup({
      listNotifications,
      markAllNotificationsRead: () => new Promise<void>(() => undefined),
    });
    const { result } = renderHook(
      () => ({ inbox: useNotifications(), readAll: useMarkAllRead() }),
      { wrapper: Wrapper },
    );
    await waitFor(() => {
      expect(result.current.inbox.hasMore).toBe(true);
    });

    act(() => {
      result.current.inbox.loadMore();
    });

    await waitFor(() => {
      expect(result.current.inbox.items.map((item) => item.id)).toEqual(['a', 'b', 'c']);
    });
    expect(result.current.inbox.hasMore).toBe(false);
    expect(listNotifications).toHaveBeenLastCalledWith(
      { cursor: 'b' },
      { signal: expect.any(AbortSignal) },
    );

    act(() => {
      result.current.readAll.mutate();
    });

    await waitFor(() => {
      expect(result.current.inbox.unreadCount).toBe(0);
    });
    expect(result.current.inbox.items.every((item) => item.readAt !== null)).toBe(true);
  });
});
