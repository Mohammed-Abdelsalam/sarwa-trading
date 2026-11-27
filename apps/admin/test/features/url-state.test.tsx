import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AuditPage } from '../../src/features/audit/audit-page';
import { CustomersScreen } from '../../src/features/customers/customers-page';
import { OrdersPage } from '../../src/features/orders/orders-page';
import { StocksPage } from '../../src/features/stocks/stocks-page';
import { TeamScreen } from '../../src/features/team/team-page';
import {
  type ApiCall,
  makeCustomer,
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

const customers = {
  'GET admin/customers': { items: [makeCustomer()], nextCursor: null, total: 1 },
};

describe('Customers URL state', () => {
  it('restores the filters from a shared link and sends them to the API', async () => {
    const { calls } = open(
      '/customers?q=sara&status=suspended&verified=1&open=1',
      <CustomersScreen />,
      customers,
    );

    expect(screen.getByLabelText('Search customers')).toHaveValue('sara');
    expect(screen.getByRole('radio', { name: /^Suspended/ })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Verified' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Has open orders' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await waitFor(() => {
      expect(lastQuery(calls, 'admin/customers')?.toString()).toBe(
        'q=sara&status=suspended&verified=true&hasOpenOrders=true&limit=50',
      );
    });
  });

  it('pushes filter changes so Back undoes them, and clears them all at once', async () => {
    open('/customers', <CustomersScreen />, customers);

    await userEvent.click(await screen.findByRole('radio', { name: 'Active' }));
    expect(search().get('status')).toBe('active');
    await userEvent.click(screen.getByRole('button', { name: 'Verified' }));
    expect(search().get('verified')).toBe('1');
    await userEvent.click(screen.getByRole('button', { name: 'Has open orders' }));
    expect(search().get('open')).toBe('1');
    await userEvent.click(screen.getByRole('button', { name: 'Has open orders' }));
    expect(search().get('open')).toBeNull();

    back();
    await waitFor(() => {
      expect(search().get('open')).toBe('1');
    });
    expect(screen.getByRole('button', { name: 'Has open orders' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('writes the search to the URL once typing pauses', async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const { calls } = open('/customers', <CustomersScreen />, customers);
    const searched = () => calls.map((call) => call.query.get('q'));

    await user.type(screen.getByLabelText('Search customers'), 'sar');
    expect(search().get('q')).toBeNull();

    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(search().get('q')).toBe('sar');
    await waitFor(() => {
      expect(searched()).toContain('sar');
    });
    expect(searched()).not.toContain('s');
    jest.useRealTimers();
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

describe('Team URL state', () => {
  it('keeps the status filter and search in the URL', async () => {
    open('/team?status=disabled&q=lee', <TeamScreen />, {
      'GET admin/invites': { items: [] },
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
