import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { marketPill } from '@sarwa/core';

import { AccountMenu } from '../../../src/components/layout/account-menu';
import { NotificationCenter } from '../../../src/components/layout/notification-center';
import { TopNav } from '../../../src/components/layout/top-nav';
import { useAccountMenu } from '../../../src/components/layout/use-account-menu';
import {
  notificationRows,
  type NotificationRow,
  notificationTarget,
  useNotificationCenter,
} from '../../../src/components/layout/use-notification-center';
import { useTopNav } from '../../../src/components/layout/use-top-nav';
import { testCopy } from '../../copy';

jest.mock('../../../src/components/layout/use-top-nav', () => ({
  ...jest.requireActual<object>('../../../src/components/layout/use-top-nav'),
  useTopNav: jest.fn(),
}));
jest.mock('../../../src/components/layout/use-notification-center', () => ({
  ...jest.requireActual<object>('../../../src/components/layout/use-notification-center'),
  useNotificationCenter: jest.fn(),
}));
jest.mock('../../../src/components/layout/use-account-menu');
jest.mock('../../../src/components/layout/command-menu', () => ({ CommandMenu: () => null }));

const copy = testCopy();
const session = {
  phase: 'regular' as const,
  isOpen: true,
  opensAt: Date.UTC(2026, 10, 27, 14, 30),
  closesAt: Date.UTC(2026, 10, 27, 18),
  earlyClose: true,
};

function navModel(overrides: Partial<ReturnType<typeof useTopNav>> = {}) {
  const links = [
    { href: '/', label: 'Home' },
    { href: '/markets', label: 'Markets' },
    { href: '/portfolio', label: 'Portfolio' },
    { href: '/watchlist', label: 'Watchlist' },
    { href: '/orders', label: 'Orders' },
  ];
  return {
    links: links.map((link) => ({ ...link, active: link.href === '/portfolio' })),
    live: 'live',
    pill: marketPill('live', session, copy),
    palette: { open: false, setOpen: jest.fn(), shortcut: 'Ctrl K' },
    labels: {
      main: 'Main',
      sections: 'Sections',
      search: 'Search or jump to…',
      searchA11y: 'Search or run a command',
    },
    ...overrides,
  } as ReturnType<typeof useTopNav>;
}

function row(overrides: Partial<NotificationRow> = {}): NotificationRow {
  return {
    id: 'n1',
    title: 'Order filled',
    body: 'Bought 2 AAPL for $463.04',
    tone: 'pos',
    href: '/orders?order=o1',
    when: '2 min ago',
    unread: true,
    today: true,
    ...overrides,
  };
}

function centerModel(overrides: Partial<ReturnType<typeof useNotificationCenter>> = {}) {
  return {
    open: true,
    unreadCount: 3,
    hasMore: false,
    isLoadingMore: false,
    today: [row()],
    earlier: [
      row({ id: 'n2', title: 'Order expired', unread: false, today: false, tone: 'muted' }),
    ],
    labels: {
      bell: 'Notifications, 3 unread',
      title: 'Notifications',
      markAllRead: 'Mark all read',
      today: 'Today',
      earlier: 'Earlier',
      empty: 'All caught up',
      unread: 'Unread',
      settings: 'Notification settings',
      loadMore: 'Load more',
    },
    setOpen: jest.fn(),
    loadMore: jest.fn(),
    markAllRead: jest.fn(),
    select: jest.fn(),
    ...overrides,
  };
}

function accountModel(): ReturnType<typeof useAccountMenu> {
  return {
    theme: 'light',
    locale: 'en',
    digits: 'latn',
    handle: 'ACC-1A2B3C',
    equity: '$102,431.20',
    buyingPower: '$40,112.00',
    languages: [
      { value: 'en' as const, label: 'English' },
      { value: 'ar' as const, label: 'العربية' },
    ],
    digitOptions: [
      { value: 'latn' as const, label: 'Western · 123' },
      { value: 'arab' as const, label: 'Arabic-Indic · ١٢٣' },
    ],
    labels: {
      trigger: 'Account menu',
      paper: 'PAPER',
      account: 'Paper account',
      equity: 'Equity',
      buyingPower: 'Buying power',
      settings: 'Settings',
      alerts: 'Alerts',
      theme: 'Dark theme',
      language: 'Language',
      digits: 'Digits',
      disclosure: 'Simulated prices',
    },
    actions: { toggleTheme: jest.fn(), setLocale: jest.fn(), setDigits: jest.fn(), go: jest.fn() },
  };
}

describe('TopNav', () => {
  beforeEach(() => {
    jest.mocked(useNotificationCenter).mockReturnValue(centerModel({ open: false }));
    jest.mocked(useAccountMenu).mockReturnValue(accountModel());
  });

  it('marks the current section in every navigation', () => {
    jest.mocked(useTopNav).mockReturnValue(navModel());
    render(<TopNav />);

    for (const link of screen.getAllByRole('link', { name: 'Portfolio' })) {
      expect(link).toHaveAttribute('aria-current', 'page');
    }
    for (const link of screen.getAllByRole('link', { name: 'Markets' })) {
      expect(link).not.toHaveAttribute('aria-current');
    }
  });

  it('opens the command palette from the search button', async () => {
    const model = navModel();
    jest.mocked(useTopNav).mockReturnValue(model);
    render(<TopNav />);

    const [button] = screen.getAllByRole('button', { name: 'Search or run a command' });
    if (!button) throw new Error('missing search button');
    await userEvent.click(button);

    expect(model.palette.setOpen).toHaveBeenCalledWith(true);
  });

  it('shows the session in the market pill', () => {
    jest.mocked(useTopNav).mockReturnValue(navModel());
    render(<TopNav />);

    expect(screen.getByRole('status')).toHaveTextContent(/Early close/);
  });

  it('shows the bell with the unread count', () => {
    jest.mocked(useTopNav).mockReturnValue(navModel());
    render(<TopNav />);

    expect(screen.getByRole('button', { name: 'Notifications, 3 unread' })).toHaveTextContent('3');
  });
});

describe('marketPill', () => {
  it('replaces the session with the connection state when not live', () => {
    expect(marketPill('reconnecting', session, copy)).toMatchObject({
      state: 'reconnecting',
      label: 'Reconnecting…',
    });
    expect(marketPill('offline', session, copy).label).toBe('Offline');
    expect(marketPill('live', { ...session, earlyClose: false }, copy).label).toMatch(
      /^Open · closes/,
    );
    expect(marketPill('live', { ...session, phase: 'closed', isOpen: false }, copy).state).toBe(
      'closed',
    );
  });
});

describe('NotificationCenter', () => {
  it('groups notifications and marks them read', async () => {
    const model = centerModel();
    jest.mocked(useNotificationCenter).mockReturnValue(model);
    render(<NotificationCenter />);

    const today = screen.getByRole('region', { name: 'Today' });
    expect(within(today).getByText('Order filled')).toBeInTheDocument();
    expect(within(today).getByText('Unread')).toBeInTheDocument();
    const earlier = screen.getByRole('region', { name: 'Earlier' });
    expect(within(earlier).getByText('Order expired')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Mark all read' }));
    expect(model.markAllRead).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: /Order filled/ }));
    expect(model.select).toHaveBeenCalledWith(expect.objectContaining({ id: 'n1' }));
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('loads older notifications on demand', async () => {
    const model = centerModel({ hasMore: true });
    jest.mocked(useNotificationCenter).mockReturnValue(model);
    render(<NotificationCenter />);

    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));

    expect(model.loadMore).toHaveBeenCalledTimes(1);
  });
});

describe('notificationRows', () => {
  it('renders fills with their amount and routes each kind', () => {
    const now = Date.UTC(2026, 10, 27, 15);
    const [filled] = notificationRows(
      [
        {
          id: 'n1',
          readAt: null,
          createdAt: now - 60_000,
          payload: {
            kind: 'order_filled',
            orderId: 'o1',
            symbol: 'AAPL',
            side: 'buy',
            qtyMicros: 2_159_827,
            priceTicks: 2_315_000,
            notionalCents: 50_000,
          },
        },
      ],
      now,
      copy,
    );

    expect(filled).toMatchObject({
      title: 'Order filled',
      body: 'Bought 2.159827 AAPL for $500.00',
      tone: 'pos',
      href: '/orders?order=o1',
      unread: true,
    });
    expect(notificationTarget({ kind: 'market_notice', message: 'Hi' })).toEqual({
      tone: 'info',
      href: '/',
    });
  });
});

describe('AccountMenu', () => {
  it('shows the paper summary and switches theme and language', async () => {
    const model = accountModel();
    jest.mocked(useAccountMenu).mockReturnValue(model);
    render(<AccountMenu />);

    const trigger = screen.getByRole('button', { name: 'Account menu' });
    expect(trigger).toHaveTextContent('PAPER');
    await userEvent.click(trigger);

    expect(screen.getByText('$102,431.20')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('menuitem', { name: /Dark theme/ }));
    expect(model.actions.toggleTheme).toHaveBeenCalledTimes(1);

    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'العربية' }));
    expect(model.actions.setLocale).toHaveBeenCalledWith('ar');
  });
});
