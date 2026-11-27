import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type AdminOrder, type AdminOrderStats } from '@sarwa/contracts';

import { OrdersPage } from '../../src/features/orders/orders-page';
import { me, renderWithApi } from '../utils';

const stats = (overrides: Partial<AdminOrderStats> = {}): AdminOrderStats => ({
  ordersToday: 4_812,
  fillRateBps: 9_340,
  rejectedBps: 210,
  notionalTodayCents: 1_840_000_000,
  activeTraders: 612,
  rejectionsByReason: [{ code: 'INSUFFICIENT_FUNDS', count: 41 }],
  typeMix: [],
  amountOrders: 0,
  ...overrides,
});

function setup(overrides: Partial<AdminOrderStats> = {}) {
  return renderWithApi(<OrdersPage />, {
    'GET admin/auth/me': me(),
    'GET admin/orders': { items: [] },
    'GET admin/orders/stats': stats(overrides),
  });
}

describe('OrdersPage', () => {
  it('shows the five KPIs and rejection reasons', async () => {
    setup();

    expect(await screen.findByText('4,812')).toBeInTheDocument();
    expect(screen.getByText('93.40%')).toBeInTheDocument();
    expect(screen.getByText('INSUFFICIENT_FUNDS')).toBeInTheDocument();
    expect(await screen.findByText('No orders yet today.')).toBeInTheDocument();
  });

  it('lists each order type with its count and share, once each', async () => {
    setup({
      typeMix: [
        { type: 'market', count: 10 },
        { type: 'limit', count: 6 },
      ],
    });

    const mix = await screen.findByRole('list', { name: 'Order type mix' });
    await waitFor(() => {
      expect(mix).toHaveTextContent('Market1062.50%');
    });
    expect(mix).toHaveTextContent('Limit637.50%');
    expect(screen.getAllByText('62.50%')).toHaveLength(1);
  });

  it('pauses the stream and counts orders that arrive meanwhile', async () => {
    const { pushOrder } = setup();

    await userEvent.click(await screen.findByRole('button', { name: 'Pause stream' }));
    for (const id of ['o-1', 'o-2', 'o-3']) pushOrder({ id } as AdminOrder);

    expect(screen.getByRole('button', { name: 'Resume stream' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText('3 new while paused')).toBeInTheDocument();
  });

  it('filters by status', async () => {
    const { calls } = setup();

    await userEvent.selectOptions(await screen.findByLabelText('Filter by status'), 'rejected');

    await waitFor(() => {
      expect(
        calls
          .filter((call) => call.path === 'admin/orders')
          .map((call) => call.query.get('status')),
      ).toEqual([null, 'rejected']);
    });
  });
});
