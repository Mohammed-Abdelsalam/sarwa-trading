import { fireEvent, screen } from '@testing-library/react-native';

import { type NotificationLine } from '../../../src/features/notifications/notification-copy';
import { NotificationsScreen } from '../../../src/features/notifications/notifications-screen';
import { useNotificationsScreen } from '../../../src/features/notifications/use-notifications-screen';
import { renderScreen } from '../../render';

jest.mock('../../../src/features/notifications/use-notifications-screen');
jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));

const mockedHook = jest.mocked(useNotificationsScreen);
type Vm = ReturnType<typeof useNotificationsScreen>;

const filled: NotificationLine = {
  id: 'n1',
  kind: 'filled',
  title: 'Order filled',
  body: 'Buy 2.159827 AAPL at $231.52',
  when: '2 min ago',
  unread: true,
  href: { pathname: '/orders/[id]', params: { id: 'o_8f21' } },
};
const expired: NotificationLine = {
  id: 'n2',
  kind: 'expired',
  title: 'Order expired',
  body: 'Buy NFLX expired at close.',
  when: 'Nov 25',
  unread: false,
  href: null,
};

function viewModel(overrides: Partial<Vm> = {}): Vm {
  return {
    items: [
      { type: 'header', key: 'today', title: 'Today' },
      { type: 'row', key: filled.id, line: filled },
      { type: 'header', key: 'earlier', title: 'Earlier' },
      { type: 'row', key: expired.id, line: expired },
    ],
    unreadCount: 1,
    isLoading: false,
    isError: false,
    isLoadingMore: false,
    actions: { retry: jest.fn(), markAllRead: jest.fn(), open: jest.fn(), loadMore: jest.fn() },
    ...overrides,
  };
}

describe('NotificationsScreen', () => {
  it('groups notifications into Today and Earlier with unread dots', async () => {
    mockedHook.mockReturnValue(viewModel());
    await renderScreen(<NotificationsScreen />);

    expect(screen.getByRole('header', { name: 'Today' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Earlier' })).toBeOnTheScreen();
    expect(screen.getByText('Buy 2.159827 AAPL at $231.52')).toBeOnTheScreen();
    expect(screen.getAllByTestId('unread-dot')).toHaveLength(1);
    expect(
      screen.getByRole('button', {
        name: 'Unread, Order filled, Buy 2.159827 AAPL at $231.52, 2 min ago',
      }),
    ).toBeOnTheScreen();
  });

  it('marks everything read and opens a notification', async () => {
    const model = viewModel();
    mockedHook.mockReturnValue(model);
    await renderScreen(<NotificationsScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Mark all read' }));
    await fireEvent.press(screen.getByText('Order filled'));

    expect(model.actions.markAllRead).toHaveBeenCalledTimes(1);
    expect(model.actions.open).toHaveBeenCalledWith(filled);
  });

  it('hides Mark all read and says so when everything is read', async () => {
    mockedHook.mockReturnValue(viewModel({ items: [], unreadCount: 0 }));
    await renderScreen(<NotificationsScreen />);

    expect(screen.getByText("You're all caught up.")).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Mark all read' })).not.toBeOnTheScreen();
  });

  it('loads older notifications when the list nears its end', async () => {
    const model = viewModel();
    mockedHook.mockReturnValue(model);
    await renderScreen(<NotificationsScreen />);

    await fireEvent(screen.getByTestId('notifications-list'), 'endReached');

    expect(model.actions.loadMore).toHaveBeenCalledTimes(1);
  });
});
