import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AccountsPage } from '../../src/features/accounts/accounts-page';
import { AuditPage } from '../../src/features/audit/audit-page';
import { OrdersPage } from '../../src/features/orders/orders-page';
import { StocksPage } from '../../src/features/stocks/stocks-page';
import { UsersPage } from '../../src/features/users/users-page';
import {
  type ApiCall,
  makeAccount,
  makeStock,
  makeUser,
  me,
  renderWithApi,
  type Routes,
} from '../utils';

const search = () => new URLSearchParams(window.location.search);

function open(path: string, ui: React.ReactElement, routes: Routes) {
  window.history.replaceState(null, '', path);
  return renderWithApi(ui, { 'GET admin/auth/me': me(), ...routes });
}

function back() {
  act(() => {
    window.history.back();
  });
}

const lastQuery = (calls: ApiCall[], path: string) =>
  calls.filter((call) => call.path === path).at(-1)?.query;

const accounts = {
  'GET admin/accounts': (call: ApiCall) => ({
    items: [makeAccount()],
    total: 60,
    page: Number(call.query.get('page') ?? 1),
    pageSize: 25,
  }),
};

describe('Accounts URL state', () => {
  it('restores search, sort and page from a shared link', async () => {
    const { calls } = open('/accounts?q=acc&sort=equity&page=2', <AccountsPage />, accounts);

    expect(await screen.findByRole('region', { name: 'Accounts' })).toBeInTheDocument();
    expect(screen.getByLabelText('Search accounts')).toHaveValue('acc');
    expect(screen.getByRole('columnheader', { name: 'Equity' })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
    expect(screen.getByText('Page 2 / 3')).toBeInTheDocument();
    const query = lastQuery(calls, 'admin/accounts');
    expect(query?.get('q')).toBe('acc');
    expect(query?.get('sort')).toBe('equity');
    expect(query?.get('page')).toBe('2');
  });

  it('pushes sort and page changes so Back undoes them', async () => {
    open('/accounts', <AccountsPage />, accounts);

    await userEvent.click(await screen.findByRole('button', { name: 'Next page' }));
    expect(search().get('page')).toBe('2');
    await userEvent.click(screen.getByRole('button', { name: 'Equity' }));
    expect(search().get('sort')).toBe('equity');
    expect(search().get('page')).toBeNull();

    back();
    await waitFor(() => {
      expect(search().get('page')).toBe('2');
    });
    expect(screen.getByRole('columnheader', { name: 'All-time' })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
  });

  it('writes the search to the URL once typing pauses and resets the page', async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const { calls } = open('/accounts?page=3', <AccountsPage />, accounts);
    const searched = () => calls.map((call) => call.query.get('q'));

    await user.type(await screen.findByLabelText('Search accounts'), 'acc');
    expect(search().get('q')).toBeNull();

    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(search().get('q')).toBe('acc');
    expect(search().get('page')).toBeNull();
    expect(screen.getByLabelText('Search accounts')).toHaveValue('acc');
    await waitFor(() => {
      expect(searched()).toContain('acc');
    });
    expect(searched()).not.toContain('a');
    expect(searched()).not.toContain('ac');
    jest.useRealTimers();
  });

  it('puts the search box back in step when Back changes the URL', async () => {
    window.history.replaceState(null, '', '/accounts?q=first');
    window.history.pushState(null, '', '/accounts?q=second');
    renderWithApi(<AccountsPage />, { 'GET admin/auth/me': me(), ...accounts });
    expect(await screen.findByLabelText('Search accounts')).toHaveValue('second');

    back();

    await waitFor(() => {
      expect(screen.getByLabelText('Search accounts')).toHaveValue('first');
    });
  });
});

describe('Audit URL state', () => {
  const audit = {
    'GET admin/audit': { items: [], total: 0, page: 1, pageSize: 25 },
  };

  it('filters by action through the URL and clears every filter at once', async () => {
    const { calls } = open('/audit?actor=maya', <AuditPage />, audit);

    expect(screen.getByLabelText('Actor')).toHaveValue('maya');
    await userEvent.selectOptions(screen.getByLabelText('Action'), 'market.pause');

    expect(search().get('action')).toBe('market.pause');
    await waitFor(() => {
      expect(lastQuery(calls, 'admin/audit')?.get('action')).toBe('market.pause');
    });
    expect(lastQuery(calls, 'admin/audit')?.get('actor')).toBe('maya');

    await userEvent.click(screen.getAllByRole('button', { name: 'Clear' })[0]!);
    expect(window.location.search).toBe('');
    expect(screen.getByLabelText('Actor')).toHaveValue('');

    back();
    await waitFor(() => {
      expect(screen.getByLabelText('Action')).toHaveValue('market.pause');
    });
  });

  it('ignores an action the dashboard does not know', () => {
    open('/audit?action=drop.tables', <AuditPage />, audit);
    expect(screen.getByLabelText('Action')).toHaveValue('all');
  });
});

describe('Orders URL state', () => {
  it('keeps the status filter in the URL', async () => {
    const { calls } = open('/orders?status=filled', <OrdersPage />, {
      'GET admin/orders': { items: [] },
      'GET admin/orders/stats': {
        ordersToday: 0,
        fillRateBps: 0,
        rejectedBps: 0,
        notionalTodayCents: 0,
        activeTraders: 0,
        rejectionsByReason: [],
        typeMix: [],
        amountOrders: 0,
      },
    });

    expect(screen.getByLabelText('Filter by status')).toHaveValue('filled');
    await waitFor(() => {
      expect(lastQuery(calls, 'admin/orders')?.get('status')).toBe('filled');
    });

    await userEvent.selectOptions(screen.getByLabelText('Filter by status'), 'all');
    expect(search().get('status')).toBeNull();
  });
});

describe('Stocks URL state', () => {
  const stocks = {
    'GET admin/stocks': {
      items: [
        makeStock(),
        makeStock({ symbol: 'XOM', name: 'Exxon Mobil', sector: 'energy', exchange: 'NYSE' }),
      ],
    },
  };

  it('restores filters and sort from the URL and pushes sort changes', async () => {
    open('/stocks?sector=energy&sort=basePrice&dir=desc', <StocksPage />, stocks);

    expect(await screen.findByText('XOM')).toBeInTheDocument();
    expect(screen.queryByText('AAPL')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Sector')).toHaveValue('energy');
    expect(screen.getByRole('columnheader', { name: 'Base price' })).toHaveAttribute(
      'aria-sort',
      'descending',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Base price' }));
    expect(search().get('dir')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Symbol' }));
    expect(search().get('sort')).toBeNull();

    back();
    await waitFor(() => {
      expect(search().get('sort')).toBe('basePrice');
    });
  });
});

describe('Users URL state', () => {
  it('keeps the status filter and search in the URL', async () => {
    open('/users?status=disabled&q=lee', <UsersPage />, {
      'GET admin/users': {
        items: [
          makeUser(),
          makeUser({
            id: 'u3',
            email: 'lee@minitrading.dev',
            name: 'Lee Chen',
            status: 'disabled',
          }),
        ],
      },
    });

    expect(await screen.findByText('lee@minitrading.dev')).toBeInTheDocument();
    expect(screen.queryByText('maya@minitrading.dev')).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Disabled' })).toBeChecked();
    expect(screen.getByLabelText('Search users')).toHaveValue('lee');

    await userEvent.click(screen.getByRole('radio', { name: 'All' }));
    expect(search().get('status')).toBeNull();
    expect(search().get('q')).toBe('lee');
  });
});
