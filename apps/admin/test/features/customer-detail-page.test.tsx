import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type CustomerDetail } from '@sarwa/contracts';

import { type CustomerActionView } from '../../src/features/customer-detail/customer-actions';
import {
  type CustomerDetailView,
  CustomerDetailPage,
} from '../../src/features/customer-detail/customer-detail-page';
import { makeCustomer, NOW, renderWithProviders } from '../utils';

function makeDetail(overrides: Partial<CustomerDetail> = {}): CustomerDetail {
  return {
    customer: makeCustomer(),
    lastActiveDevice: 'iPhone 15',
    activeSessions: 2,
    suspension: null,
    portfolio: {
      equityCents: 11_019_429,
      dayCents: 41_210,
      cashCents: 3_120_000,
      reservedCents: 50_000,
      allTimeCents: 1_019_429,
      allTimeBps: 1_019,
      positions: [
        {
          symbol: 'NVDA',
          qtyMicros: 12_000_000,
          costBasisCents: 1_200_000,
          marketValueCents: 1_420_000,
        },
      ],
    },
    ...overrides,
  };
}

function makeAction(overrides: Partial<CustomerActionView> = {}): CustomerActionView {
  return {
    kind: null,
    category: 'abuse',
    reason: '',
    confirm: '',
    phrase: 'RESET ACC-7F2E9C',
    reasonLimits: { min: 10, max: 280 },
    reasonInvalid: false,
    canSubmit: false,
    isSaving: false,
    failed: false,
    startingCashCents: 10_000_000,
    actions: {
      open: jest.fn(),
      close: jest.fn(),
      setCategory: jest.fn(),
      setReason: jest.fn(),
      setConfirm: jest.fn(),
      submit: jest.fn(),
    },
    ...overrides,
  };
}

function makeView(overrides: Partial<CustomerDetailView> = {}): CustomerDetailView {
  return {
    status: 'ready',
    detail: makeDetail(),
    error: null,
    positions: [
      {
        symbol: 'NVDA',
        sector: 'tech',
        qtyMicros: 12_000_000,
        avgCostCents: 10_000,
        marketValueCents: 1_420_000,
        returnCents: 220_000,
        returnBps: 1_833,
      },
    ],
    purgesAt: null,
    isViewer: false,
    canEdit: true,
    tab: 'overview',
    now: NOW,
    listHref: '/customers',
    orders: { items: [], status: 'ready' },
    sessions: {
      items: [
        {
          id: 's1',
          label: 'Chrome on macOS',
          platform: 'web',
          ipMasked: '41.32.•.•',
          lastActiveAt: NOW - 60_000,
          createdAt: Date.UTC(2026, 10, 1),
        },
      ],
      status: 'ready',
      fullIps: null,
      isRevealing: false,
    },
    activity: {
      items: [
        {
          id: 'a1',
          at: NOW - 3_600_000,
          actor: { kind: 'admin', email: 'maya@minitrading.dev' },
          action: 'customer.reset_password_sent',
          preview: 'reason: asked by phone',
        },
        {
          id: 'a2',
          at: NOW - 7_200_000,
          actor: { kind: 'customer', email: null },
          action: 'order.filled',
          preview: 'NVDA · 2 shares',
        },
      ],
      status: 'ready',
      hasMore: true,
      isFetchingMore: false,
    },
    action: makeAction(),
    actions: {
      retry: jest.fn(),
      setTab: jest.fn(),
      retryOrders: jest.fn(),
      retrySessions: jest.fn(),
      revealIps: jest.fn(),
      hideIps: jest.fn(),
      retryActivity: jest.fn(),
      loadMoreActivity: jest.fn(),
    },
    ...overrides,
  };
}

describe('CustomerDetailPage', () => {
  it('shows who the customer is, their portfolio and the four tabs', async () => {
    const view = makeView();
    renderWithProviders(<CustomerDetailPage view={view} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Sara Hassan' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Customers' })).toHaveAttribute('href', '/customers');
    expect(screen.getByText('Email verified')).toBeInTheDocument();
    expect(screen.getByText(/Last active .* · iPhone 15/)).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab').map((tab) => tab.textContent);
    expect(tabs).toEqual(['Overview', 'Orders · 3 open', 'Sessions / devices · 2', 'Activity']);
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    expect(
      within(screen.getByRole('table', { name: 'Positions' })).getByText('NVDA'),
    ).toBeVisible();

    await userEvent.click(screen.getByRole('tab', { name: 'Activity' }));
    expect(view.actions.setTab).toHaveBeenCalledWith('activity');
    screen.getByRole('tab', { name: 'Overview' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(view.actions.setTab).toHaveBeenLastCalledWith('orders');
  });

  it('offers suspend for an active customer and reactivate once suspended', async () => {
    const view = makeView();
    const { rerender } = renderWithProviders(<CustomerDetailPage view={view} />);

    await userEvent.click(screen.getByRole('button', { name: 'Suspend customer…' }));
    expect(view.action.actions.open).toHaveBeenCalledWith('suspend');
    expect(screen.getByText(/Admins can’t view passwords, trade for/)).toBeInTheDocument();

    rerender(
      <CustomerDetailPage
        view={makeView({
          detail: makeDetail({
            customer: makeCustomer({ status: 'suspended' }),
            suspension: {
              reasonCategory: 'abuse',
              reason: 'Automated order spam from a script.',
              at: NOW - 86_400_000,
              by: 'maya@minitrading.dev',
            },
          }),
        })}
      />,
    );
    expect(screen.getByRole('button', { name: 'Reactivate customer' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Suspend customer…' })).not.toBeInTheDocument();
    expect(screen.getByText(/Automated order spam from a script\./)).toHaveTextContent(
      'Abuse · automated trading scripts · Automated order spam from a script.',
    );
  });

  it('asks for a category and a 10–280 character reason before suspending', async () => {
    const action = makeAction({ kind: 'suspend', reason: 'spam', reasonInvalid: true });
    renderWithProviders(<CustomerDetailPage view={makeView({ action })} />);

    const dialog = screen.getByRole('dialog', { name: 'Suspend Sara Hassan?' });
    expect(dialog).toHaveTextContent('signed out on 2 devices');
    await userEvent.selectOptions(within(dialog).getByLabelText('Reason category'), 'fraud');
    expect(action.actions.setCategory).toHaveBeenCalledWith('fraud');
    const reason = within(dialog).getByLabelText('Reason (shown to the customer)');
    expect(reason).toHaveAttribute('aria-invalid', 'true');
    expect(reason).toHaveAccessibleDescription(
      'Required · 10–280 characters · stored in the audit log',
    );
    await userEvent.type(reason, 'x');
    expect(action.actions.setReason).toHaveBeenCalledWith('spamx');
    expect(within(dialog).getByRole('button', { name: 'Suspend customer' })).toBeDisabled();
  });

  it('needs RESET and the account id typed to reset the practice account', async () => {
    const action = makeAction({ kind: 'resetAccount', canSubmit: true });
    renderWithProviders(<CustomerDetailPage view={makeView({ action })} />);

    const dialog = screen.getByRole('dialog', { name: 'Reset practice account?' });
    expect(dialog).toHaveTextContent('Closes 1 position at last price, cancels 3 open orders');
    expect(dialog).toHaveTextContent('After reset');
    await userEvent.type(within(dialog).getByLabelText('Type RESET ACC-7F2E9C to confirm'), 'R');
    expect(action.actions.setConfirm).toHaveBeenCalledWith('R');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reset account' }));
    expect(action.actions.submit).toHaveBeenCalled();
  });

  it('locks every action for viewers and says why', async () => {
    const view = makeView({ isViewer: true, canEdit: false, tab: 'sessions' });
    renderWithProviders(<CustomerDetailPage view={view} />);

    expect(screen.getByText(/Actions are disabled for VIEWER/)).toBeInTheDocument();
    for (const name of [
      'Suspend customer…',
      'Sign out all devices…',
      'Send password reset email',
      'Reset practice account…',
      'Show full IPs',
    ]) {
      const button = screen.getByRole('button', { name });
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).toHaveAccessibleDescription("Viewers can't make changes");
      await userEvent.click(button);
    }
    expect(view.action.actions.open).not.toHaveBeenCalled();
    expect(view.actions.revealIps).not.toHaveBeenCalled();
  });

  it('masks session IPs until an ADMIN reveals them', async () => {
    const view = makeView({ tab: 'sessions' });
    const { rerender } = renderWithProviders(<CustomerDetailPage view={view} />);

    expect(screen.getByText(/41\.32\.•\.• · active/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Show full IPs' }));
    expect(view.actions.revealIps).toHaveBeenCalled();

    rerender(
      <CustomerDetailPage
        view={makeView({
          tab: 'sessions',
          sessions: { ...view.sessions, fullIps: { s1: '41.32.7.9' } },
        })}
      />,
    );
    expect(screen.getByText(/41\.32\.7\.9 · active/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide full IPs' })).toBeInTheDocument();
  });

  it('lists activity with who did it and loads older entries on demand', async () => {
    const view = makeView({ tab: 'activity' });
    renderWithProviders(<CustomerDetailPage view={view} />);

    const [, reset, filled] = screen.getAllByRole('row');
    expect(reset).toHaveTextContent('maya@minitrading.dev (admin)');
    expect(reset).toHaveTextContent('customer.reset_password_sent');
    expect(filled).toHaveTextContent('customer');
    expect(filled).toHaveTextContent('order.filled');
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(view.actions.loadMoreActivity).toHaveBeenCalled();
  });

  it('says when the customer does not exist', () => {
    renderWithProviders(
      <CustomerDetailPage view={makeView({ status: 'notFound', detail: null })} />,
    );
    expect(screen.getByText('This customer doesn’t exist or was deleted.')).toBeInTheDocument();
  });
});
