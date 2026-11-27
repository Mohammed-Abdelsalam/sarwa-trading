import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type Route } from 'next';

import { type CustomersView, CustomersPage } from '../../src/features/customers/customers-page';
import { makeCustomer, NOW, renderWithProviders } from '../utils';

function makeView(overrides: Partial<CustomersView> = {}): CustomersView {
  return {
    isViewer: false,
    canEdit: true,
    kpis: {
      registered: 8_412,
      registeredWeekBps: 200,
      signedUpToday: 164,
      signedUpTodayMobileBps: 4_100,
      active24h: 3_207,
      suspended: 37,
      suspendedToday: 2,
      verifiedBps: 8_640,
      verifiedDeltaBps: 110,
      guests24h: 2_930,
      conversionBps: 610,
      activeShareBps: 3_800,
      suspendedShareBps: 40,
    },
    rows: [
      makeCustomer(),
      makeCustomer({
        id: 'c2',
        handle: 'ACC-2B8A4D',
        name: 'Ahmed Nabil',
        email: 'a.nabil@example.com',
        status: 'suspended',
        emailVerified: false,
      }),
    ],
    status: 'ready',
    error: null,
    search: '',
    segment: 'all',
    verified: false,
    hasOpenOrders: false,
    hasMore: false,
    isFetchingMore: false,
    isExporting: false,
    linkCopied: false,
    now: NOW,
    detailHref: (handle) => `/customers/${handle}` as Route,
    actions: {
      retry: jest.fn(),
      search: jest.fn(),
      setSegment: jest.fn(),
      toggleVerified: jest.fn(),
      toggleOpenOrders: jest.fn(),
      clearFilters: jest.fn(),
      loadMore: jest.fn(),
      exportCsv: jest.fn(),
      copyAppLink: jest.fn(),
      request: jest.fn(),
    },
    ...overrides,
  };
}

describe('CustomersPage', () => {
  it('shows the KPI strip and one row per customer with status and verification', () => {
    renderWithProviders(<CustomersPage view={makeView()} />);

    expect(screen.getByRole('heading', { name: 'Customers' })).toBeInTheDocument();
    expect(screen.getByText(/^8,412 registered/)).toBeInTheDocument();
    expect(screen.getByText('Registered customers')).toBeInTheDocument();
    expect(screen.getByText('Guest visitors · 24h')).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Customers' });
    const [, sara, ahmed] = within(table).getAllByRole('row');
    expect(within(sara!).getByRole('link', { name: 'Sara Hassan' })).toHaveAttribute(
      'href',
      '/customers/ACC-7F2E9C',
    );
    expect(sara).toHaveTextContent('sara.h@example.com');
    expect(sara).toHaveTextContent('ACC-7F2E9C');
    expect(sara).toHaveTextContent('Active');
    expect(sara).toHaveTextContent('Verified');
    expect(ahmed).toHaveTextContent('Suspended');
    expect(ahmed).toHaveTextContent('Unverified');
  });

  it('hands every toolbar change and row action to the view', async () => {
    const view = makeView();
    renderWithProviders(<CustomersPage view={view} />);

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search customers' }), 's');
    expect(view.actions.search).toHaveBeenCalledWith('s');
    await userEvent.click(screen.getByRole('radio', { name: 'Suspended · 37' }));
    expect(view.actions.setSegment).toHaveBeenCalledWith('suspended');
    const verified = screen.getByRole('button', { name: 'Verified' });
    expect(verified).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(verified);
    expect(view.actions.toggleVerified).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Has open orders' }));
    expect(view.actions.toggleOpenOrders).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(view.actions.exportCsv).toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Actions for Ahmed Nabil' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Reactivate customer' }));
    expect(view.actions.request).toHaveBeenCalledWith('ACC-2B8A4D', 'reactivate');
  });

  it('gives viewers masked emails, a banner, and locked export and row actions', async () => {
    const view = makeView({
      isViewer: true,
      canEdit: false,
      rows: [makeCustomer({ email: 's•••@example.com' })],
    });
    renderWithProviders(<CustomersPage view={view} />);

    expect(screen.getByText(/You can see customers but not change them/)).toBeInTheDocument();
    expect(screen.getByText('s•••@example.com')).toBeInTheDocument();
    const exportButton = screen.getByRole('button', { name: 'Export CSV' });
    expect(exportButton).toHaveAttribute('aria-disabled', 'true');
    expect(exportButton).toHaveAccessibleDescription('Only ADMIN can export customer data');
    await userEvent.click(exportButton);
    expect(view.actions.exportCsv).not.toHaveBeenCalled();
    const rowActions = screen.getByRole('button', { name: 'Actions for Sara Hassan' });
    expect(rowActions).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(rowActions);
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
  });

  it('keeps the admin layout while the session loads', () => {
    renderWithProviders(<CustomersPage view={makeView({ canEdit: false })} />);

    expect(screen.queryByText(/You can see customers/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeDisabled();
  });

  it('shows a skeleton while loading and the request id when loading fails', async () => {
    const { rerender } = renderWithProviders(
      <CustomersPage view={makeView({ status: 'loading', kpis: null, rows: [] })} />,
    );
    expect(screen.getByRole('status', { name: 'customers' })).toHaveAttribute('aria-busy', 'true');

    const view = makeView({
      status: 'error',
      rows: [],
      error: { status: 503, requestId: 'req_91ac2e' },
    });
    rerender(<CustomersPage view={view} />);
    expect(screen.getByText("Couldn't load customers")).toBeInTheDocument();
    expect(screen.getByText('503 · GET /admin/customers · req_91ac2e')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(view.actions.retry).toHaveBeenCalled();
  });

  it('tells an empty search apart from having no customers at all', async () => {
    const filtered = makeView({ rows: [], search: 'brk@', segment: 'suspended', verified: true });
    const { rerender } = renderWithProviders(<CustomersPage view={filtered} />);
    expect(screen.getByText('No customers match “brk@”')).toBeInTheDocument();
    expect(screen.getByText(/Filters: Suspended · Verified\./)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(filtered.actions.clearFilters).toHaveBeenCalled();

    const zero = makeView({ rows: [] });
    rerender(<CustomersPage view={zero} />);
    expect(screen.getByText('No customers yet')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Copy app link' }));
    expect(zero.actions.copyAppLink).toHaveBeenCalled();
    rerender(<CustomersPage view={makeView({ rows: [], linkCopied: true })} />);
    expect(screen.getByRole('button', { name: 'App link copied' })).toBeInTheDocument();
  });
});
