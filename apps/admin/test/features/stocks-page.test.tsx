import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ApiError } from '@sarwa/core';
import {
  useAdminSession,
  useAdminStocks,
  useCreateStock,
  useDeleteStock,
  useUpdateStock,
} from '@sarwa/core/admin';

import { StocksPage } from '../../src/features/stocks/stocks-page';
import { makeStock, mutation, query, renderWithProviders, session } from '../utils';

jest.mock('@sarwa/core/admin', () => ({
  ...jest.requireActual<object>('@sarwa/core/admin'),
  useAdminSession: jest.fn(),
  useAdminStocks: jest.fn(),
  useCreateStock: jest.fn(),
  useUpdateStock: jest.fn(),
  useDeleteStock: jest.fn(),
}));

const conflict = new ApiError({ type: 'x', title: 'Conflict', status: 409, code: 'CONFLICT' });

function setup({
  role = 'ADMIN',
  stocks = [makeStock()],
}: { role?: 'ADMIN' | 'VIEWER'; stocks?: ReturnType<typeof makeStock>[] } = {}) {
  const create = mutation();
  const update = mutation();
  const remove = mutation({
    mutate: jest.fn((_symbol: string, options: { onError: (error: unknown) => void }) => {
      options.onError(conflict);
    }),
  });
  jest.mocked(useAdminSession).mockReturnValue(session(role));
  jest.mocked(useAdminStocks).mockReturnValue(query(stocks));
  jest.mocked(useCreateStock).mockReturnValue(create as never);
  jest.mocked(useUpdateStock).mockReturnValue(update as never);
  jest.mocked(useDeleteStock).mockReturnValue(remove as never);
  renderWithProviders(<StocksPage />);
  return { create, update, remove };
}

describe('StocksPage', () => {
  it('validates the add-stock form inline and summarises the errors', async () => {
    const { create } = setup();

    await userEvent.click(screen.getByRole('button', { name: 'Add stock' }));
    const dialog = screen.getByRole('dialog', { name: 'Add stock' });
    await userEvent.type(within(dialog).getByLabelText('Symbol'), 'aapl');
    await userEvent.type(within(dialog).getByLabelText('Base price'), '-12');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add stock' }));

    expect(within(dialog).getByText('Fix 5 fields to continue.')).toBeInTheDocument();
    expect(within(dialog).getByText('This symbol already exists')).toBeInTheDocument();
    expect(within(dialog).getByText('Must be > 0')).toBeInTheDocument();
    expect(create.mutate).not.toHaveBeenCalled();

    await userEvent.clear(within(dialog).getByLabelText('Symbol'));
    await userEvent.type(within(dialog).getByLabelText('Symbol'), 'nvda');
    await userEvent.type(within(dialog).getByLabelText('Company name'), 'NVIDIA Corp.');
    await userEvent.selectOptions(within(dialog).getByLabelText('Sector'), 'tech');
    await userEvent.selectOptions(within(dialog).getByLabelText('Exchange'), 'NASDAQ');
    await userEvent.clear(within(dialog).getByLabelText('Base price'));
    await userEvent.type(within(dialog).getByLabelText('Base price'), '142.5');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add stock' }));

    expect(create.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ symbol: 'NVDA', basePrice: 142.5, volatility: 1, isEnabled: true }),
      expect.anything(),
    );
  });

  it('offers to disable a stock the server refuses to delete', async () => {
    const { remove, update } = setup();

    await userEvent.click(screen.getByRole('button', { name: 'Actions for AAPL' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete stock' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete stock' }));

    expect(remove.mutate).toHaveBeenCalledWith('AAPL', expect.anything());
    expect(screen.getByRole('dialog', { name: "AAPL can't be deleted" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Disable instead' }));
    expect(update.mutate).toHaveBeenCalledWith({ symbol: 'AAPL', patch: { isEnabled: false } });
  });

  it('toggles a stock and shows the empty state', async () => {
    const { update } = setup();

    await userEvent.click(screen.getByRole('switch', { name: 'Disable AAPL' }));
    expect(update.mutate).toHaveBeenCalledWith({ symbol: 'AAPL', patch: { isEnabled: false } });
  });

  it('shows an empty catalogue with a first-stock action', () => {
    setup({ stocks: [] });

    expect(screen.getByRole('heading', { name: 'No stocks listed yet' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add your first stock' })).toBeEnabled();
  });

  it('locks every change for viewers without hiding it', async () => {
    setup({ role: 'VIEWER' });

    expect(screen.getByRole('button', { name: 'Add stock' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByRole('switch', { name: 'Disable AAPL' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    const actions = screen.getByRole('button', { name: 'Actions for AAPL' });
    expect(actions).toHaveAccessibleDescription("Viewers can't make changes");
    await userEvent.click(actions);
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
  });
});
