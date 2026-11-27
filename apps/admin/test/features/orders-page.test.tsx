import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { bps } from '@sarwa/core';

import { OrdersPage } from '../../src/features/orders/orders-page';
import { useOrdersPage } from '../../src/features/orders/use-orders-page';
import { renderWithProviders } from '../utils';

jest.mock('../../src/features/orders/use-orders-page');

const mockedHook = jest.mocked(useOrdersPage);

function viewModel(
  overrides: Partial<ReturnType<typeof useOrdersPage>> = {},
): ReturnType<typeof useOrdersPage> {
  return {
    status: 'all',
    orders: [],
    isLoading: false,
    isError: false,
    paused: false,
    missed: 0,
    stats: {
      ordersToday: 4_812,
      fillRateBps: 9_340,
      rejectedBps: 210,
      notionalTodayCents: 1_840_000_000,
      activeTraders: 612,
      rejectionsByReason: [],
      typeMix: [],
      amountOrders: 0,
    },
    statsLoading: false,
    rejections: [{ code: 'INSUFFICIENT_FUNDS', count: 41, shareBps: bps(4_100), weight: 1 }],
    typeMix: [],
    fractionalBps: bps(4_400),
    actions: { setStatus: jest.fn(), togglePause: jest.fn(), retry: jest.fn() },
    ...overrides,
  };
}

describe('OrdersPage', () => {
  it('shows the five KPIs and rejection reasons', () => {
    mockedHook.mockReturnValue(viewModel());
    renderWithProviders(<OrdersPage />);

    expect(screen.getByText('4,812')).toBeInTheDocument();
    expect(screen.getByText('93.40%')).toBeInTheDocument();
    expect(screen.getByText('INSUFFICIENT_FUNDS')).toBeInTheDocument();
    expect(screen.getByText('No orders yet today.')).toBeInTheDocument();
  });

  it('lists each order type with its count and share, once each', () => {
    mockedHook.mockReturnValue(
      viewModel({
        typeMix: [
          { type: 'market', count: 10, shareBps: bps(6_250), weight: 0.625 },
          { type: 'limit', count: 6, shareBps: bps(3_750), weight: 0.375 },
        ],
      }),
    );
    renderWithProviders(<OrdersPage />);

    const mix = screen.getByRole('list', { name: 'Order type mix' });
    expect(mix).toHaveTextContent('Market1062.50%');
    expect(mix).toHaveTextContent('Limit637.50%');
    expect(screen.getAllByText('62.50%')).toHaveLength(1);
  });

  it('pauses the stream and then offers to resume it', async () => {
    const model = viewModel();
    mockedHook.mockReturnValue(model);
    const { unmount } = renderWithProviders(<OrdersPage />);

    await userEvent.click(screen.getByRole('button', { name: 'Pause stream' }));
    expect(model.actions.togglePause).toHaveBeenCalledTimes(1);
    unmount();

    mockedHook.mockReturnValue(viewModel({ paused: true, missed: 3 }));
    renderWithProviders(<OrdersPage />);
    expect(screen.getByRole('button', { name: 'Resume stream' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText('3 new while paused')).toBeInTheDocument();
  });

  it('filters by status', async () => {
    const model = viewModel();
    mockedHook.mockReturnValue(model);
    renderWithProviders(<OrdersPage />);

    await userEvent.selectOptions(screen.getByLabelText('Filter by status'), 'rejected');

    expect(model.actions.setStatus).toHaveBeenCalledWith('rejected');
  });
});
