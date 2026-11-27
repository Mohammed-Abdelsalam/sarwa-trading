import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type AdminUser, type CustomerDetail } from '@sarwa/contracts';

import { ToastHost } from '../../src/components/common/toasts';
import { CustomerDetailScreen } from '../../src/features/customer-detail/customer-detail-page';
import {
  type ApiCall,
  HttpError,
  makeCustomer,
  me,
  NOW,
  renderWithApi,
  type Routes,
} from '../utils';

const HANDLE = 'ACC-7F2E9C';
const BASE = `admin/customers/${HANDLE}`;
const REASON = 'Automated order flooding';

function makeDetail(overrides: Partial<CustomerDetail['customer']> = {}): CustomerDetail {
  return {
    customer: makeCustomer(overrides),
    lastActiveDevice: 'iPhone 15',
    activeSessions: 1,
    suspension: null,
    portfolio: {
      equityCents: 11_019_429,
      dayCents: 41_210,
      cashCents: 3_120_000,
      reservedCents: 0,
      allTimeCents: 1_019_429,
      allTimeBps: 1_019,
      positions: [
        {
          symbol: 'NVDA',
          qtyMicros: 10_000_000,
          costBasisCents: 1_200_000,
          marketValueCents: 1_420_000,
        },
      ],
    },
  };
}

const actionReply = { customer: makeCustomer() };

function renderDetail(role: AdminUser['role'], search = '', routes: Routes = {}) {
  window.history.replaceState(null, '', `/customers/${HANDLE}${search}`);
  return renderWithApi(
    <ToastHost>
      <CustomerDetailScreen handle={HANDLE} />
    </ToastHost>,
    {
      'GET admin/auth/me': me(role),
      'GET stocks': { items: [] },
      [`GET ${BASE}`]: makeDetail(),
      [`GET ${BASE}/orders`]: {
        items: [
          {
            id: 'o1',
            symbol: 'NVDA',
            side: 'buy',
            type: 'limit',
            tif: 'day',
            status: 'open',
            qtyMicros: 1_000_000,
            amountCents: null,
            sellAll: false,
            limitTicks: 1_200_000,
            stopTicks: null,
            quotedTicks: 1_210_000,
            filledMicros: 0,
            filledNotionalCents: 0,
            avgFillTicks: null,
            heldCents: 12_000,
            heldMicros: 0,
            rejection: null,
            cancelReason: null,
            fills: [],
            createdAt: NOW,
            updatedAt: NOW,
            triggeredAt: null,
            expiresAt: null,
            closedAt: null,
          },
        ],
        nextCursor: null,
      },
      [`GET ${BASE}/sessions`]: {
        items: [
          {
            id: 's1',
            label: 'Chrome on macOS',
            platform: 'web',
            ipMasked: '41.32.•.•',
            lastActiveAt: NOW - 60_000,
            createdAt: NOW - 86_400_000,
          },
        ],
      },
      [`GET ${BASE}/activity`]: (call: ApiCall) =>
        call.query.get('cursor') === 'a2'
          ? {
              items: [
                {
                  id: 'a2',
                  at: NOW - 7_200_000,
                  actor: { kind: 'customer', email: null },
                  action: 'order.filled',
                  detail: { symbol: 'AMD' },
                },
              ],
              nextCursor: null,
            }
          : {
              items: [
                {
                  id: 'a1',
                  at: NOW - 3_600_000,
                  actor: { kind: 'admin', email: 'maya@minitrading.dev' },
                  action: 'customer.reset_password_sent',
                  detail: { reason: 'asked by phone' },
                },
              ],
              nextCursor: 'a2',
            },
      [`POST ${BASE}/reveal`]: { items: [{ sessionId: 's1', ip: '41.32.10.7' }] },
      [`POST ${BASE}/suspend`]: actionReply,
      [`POST ${BASE}/reactivate`]: actionReply,
      [`POST ${BASE}/sign-out-all`]: { ...actionReply, sessionsRevoked: 2 },
      [`POST ${BASE}/password-reset`]: actionReply,
      [`POST ${BASE}/reset-account`]: actionReply,
      ...routes,
    },
  );
}

const posts = (calls: ApiCall[]) =>
  calls.filter((call) => call.method === 'POST').map((call) => [call.path, call.body]);
const detailReads = (calls: ApiCall[]) =>
  calls.filter((call) => call.method === 'GET' && call.path === BASE).length;

describe('Customer detail screen', () => {
  it('says so when the customer does not exist', async () => {
    renderDetail('ADMIN', '', { [`GET ${BASE}`]: new HttpError(404) });

    expect(
      await screen.findByText('This customer doesn’t exist or was deleted.'),
    ).toBeInTheDocument();
  });

  it('quotes the request id when the customer fails to load', async () => {
    renderDetail('ADMIN', '', { [`GET ${BASE}`]: new HttpError(500, 'req-77') });

    expect(await screen.findByText("Couldn't load this customer")).toBeInTheDocument();
    expect(screen.getByText('Request ID req-77')).toBeInTheDocument();
  });

  it('shows positions with avg cost and return, and keeps the tab in the URL', async () => {
    renderDetail('ADMIN');

    const positions = await screen.findByRole('table', { name: 'Positions' });
    const [, nvda] = within(positions).getAllByRole('row');
    expect(nvda).toHaveTextContent('$1,200.00');
    expect(nvda).toHaveTextContent('+$2,200.00');
    expect(screen.getByRole('tablist', { name: 'Customer sections' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: /^Orders/ }));
    expect(new URLSearchParams(window.location.search).get('tab')).toBe('orders');
    const orders = await screen.findByRole('table', { name: 'Orders monitor' });
    expect(within(orders).getByText('NVDA')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Activity' }));
    expect(await screen.findByText('maya@minitrading.dev (admin)')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('customer')).toBeInTheDocument();
  });

  it('suspends only with a reason that fits, then refetches the customer', async () => {
    const { calls } = renderDetail('ADMIN', '?action=suspend');

    const dialog = await screen.findByRole('dialog', { name: 'Suspend Sara Hassan?' });
    await userEvent.selectOptions(within(dialog).getByLabelText('Reason category'), 'fraud');
    const reason = within(dialog).getByLabelText('Reason (shown to the customer)');
    await userEvent.type(reason, 'Too short');
    await userEvent.click(screen.getByRole('button', { name: 'Suspend customer' }));
    expect(reason).toHaveAttribute('aria-invalid', 'true');
    expect(posts(calls)).toEqual([]);

    const before = detailReads(calls);
    await userEvent.clear(reason);
    await userEvent.type(reason, REASON);
    await userEvent.click(screen.getByRole('button', { name: 'Suspend customer' }));

    await waitFor(() => {
      expect(posts(calls)).toEqual([
        [`${BASE}/suspend`, { reason: REASON, reasonCategory: 'fraud' }],
      ]);
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(window.location.search).toBe('');
    await waitFor(() => {
      expect(detailReads(calls)).toBeGreaterThan(before);
    });
    expect(screen.getByRole('status')).toHaveTextContent('Sara Hassan was suspended');
  });

  it('resets the practice account only once the phrase is typed exactly', async () => {
    const { calls } = renderDetail('ADMIN');

    await userEvent.click(await screen.findByRole('button', { name: 'Reset practice account…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Reset practice account?' });
    await userEvent.type(within(dialog).getByLabelText('Reason'), REASON);
    const submit = screen.getByRole('button', { name: 'Reset account' });
    expect(submit).toBeDisabled();
    await userEvent.type(
      within(dialog).getByLabelText(`Type RESET ${HANDLE} to confirm`),
      `RESET ${HANDLE}`,
    );
    await userEvent.click(submit);

    await waitFor(() => {
      expect(posts(calls)).toEqual([
        [`${BASE}/reset-account`, { reason: REASON, confirm: `RESET ${HANDLE}` }],
      ]);
    });
    expect(await screen.findByText('Practice account reset')).toBeInTheDocument();
  });

  it.each([
    ['signOutAll', 'Sign out all devices', 'sign-out-all', 'Signed out 2 sessions'],
    ['sendReset', 'Send reset email', 'password-reset', 'Password reset email sent'],
  ])('sends %s with its reason and confirms it', async (action, submit, path, toast) => {
    const { calls } = renderDetail('ADMIN', `?action=${action}`);

    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Reason'), REASON);
    await userEvent.click(screen.getByRole('button', { name: submit }));

    await waitFor(() => {
      expect(posts(calls)).toEqual([[`${BASE}/${path}`, { reason: REASON }]]);
    });
    expect(await screen.findByText(toast)).toBeInTheDocument();
  });

  it('reactivates a suspended customer and shows a failure in the dialog', async () => {
    const { calls } = renderDetail('ADMIN', '?action=reactivate', {
      [`GET ${BASE}`]: makeDetail({ status: 'suspended' }),
      [`POST ${BASE}/reactivate`]: new HttpError(500),
    });

    const dialog = await screen.findByRole('dialog', { name: 'Reactivate Sara Hassan?' });
    await userEvent.type(within(dialog).getByLabelText('Reason'), REASON);
    await userEvent.click(screen.getByRole('button', { name: 'Reactivate customer' }));

    expect(await within(dialog).findByText(/That didn't go through/)).toBeInTheDocument();
    expect(posts(calls)).toEqual([[`${BASE}/reactivate`, { reason: REASON }]]);
    expect(screen.queryByText(/was reactivated/)).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('reveals full IPs for an ADMIN and hides them again', async () => {
    const { calls } = renderDetail('ADMIN', '?tab=sessions');

    expect(await screen.findByText(/41\.32\.•\.• · active/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Show full IPs' }));

    expect(await screen.findByText(/41\.32\.10\.7 · active/)).toBeInTheDocument();
    expect(posts(calls)).toEqual([[`${BASE}/reveal`, undefined]]);
    await userEvent.click(screen.getByRole('button', { name: 'Hide full IPs' }));
    expect(await screen.findByText(/41\.32\.•\.• · active/)).toBeInTheDocument();
  });

  it('keeps every action and the IP reveal locked for viewers', async () => {
    const { calls } = renderDetail('VIEWER', '?tab=sessions&action=suspend');

    expect(
      await screen.findByText(
        'View-only access. Actions are disabled for VIEWER. Email is masked.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const reveal = await screen.findByRole('button', { name: 'Show full IPs' });
    expect(reveal).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(reveal);
    const suspend = screen.getByRole('button', { name: 'Suspend customer…' });
    expect(suspend).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(suspend);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(posts(calls)).toEqual([]);
  });
});
