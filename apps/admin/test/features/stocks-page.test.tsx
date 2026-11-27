import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type AdminStock, type AdminUser } from '@sarwa/contracts';

import { StocksPage } from '../../src/features/stocks/stocks-page';
import { type ApiCall, HttpError, makeStock, me, renderWithApi } from '../utils';

const writes = (calls: ApiCall[]) => calls.filter((call) => call.method !== 'GET');

function renderStocks({
  role = 'ADMIN',
  stocks = [makeStock()],
}: { role?: AdminUser['role']; stocks?: AdminStock[] } = {}) {
  return renderWithApi(<StocksPage />, {
    'GET admin/auth/me': me(role),
    'GET admin/stocks': { items: stocks },
    'POST admin/stocks': (call: ApiCall) => makeStock(call.body as Partial<AdminStock>),
    'PATCH admin/stocks/AAPL': (call: ApiCall) => makeStock(call.body as Partial<AdminStock>),
    'DELETE admin/stocks/AAPL': new HttpError(409),
  });
}

describe('StocksPage', () => {
  it('shows the view-only notice only once the session says VIEWER', async () => {
    renderWithApi(<StocksPage />, {
      'GET admin/auth/me': () => new Promise(() => undefined),
      'GET admin/stocks': { items: [makeStock()] },
    });

    expect(await screen.findByText('Apple Inc.')).toBeInTheDocument();
    expect(screen.queryByText('View-only access.')).not.toBeInTheDocument();
  });

  it('validates the add-stock form inline and summarises the errors', async () => {
    const user = userEvent.setup({ delay: null });
    const { calls } = renderStocks();

    await screen.findByText('Apple Inc.');
    await user.click(screen.getByRole('button', { name: 'Add stock' }));
    const dialog = screen.getByRole('dialog', { name: 'Add stock' });
    await user.type(within(dialog).getByLabelText('Symbol'), 'aapl');
    await user.type(within(dialog).getByLabelText('Base price'), '-12');
    await user.click(within(dialog).getByRole('button', { name: 'Add stock' }));

    expect(within(dialog).getByText('Fix 5 fields to continue.')).toBeInTheDocument();
    expect(within(dialog).getByText('This symbol already exists')).toBeInTheDocument();
    expect(within(dialog).getByText('Must be > 0')).toBeInTheDocument();
    expect(writes(calls)).toEqual([]);

    await user.clear(within(dialog).getByLabelText('Symbol'));
    await user.type(within(dialog).getByLabelText('Symbol'), 'nvda');
    await user.type(within(dialog).getByLabelText('Company name'), 'NVIDIA Corp.');
    await user.selectOptions(within(dialog).getByLabelText('Sector'), 'tech');
    await user.selectOptions(within(dialog).getByLabelText('Exchange'), 'NASDAQ');
    await user.clear(within(dialog).getByLabelText('Base price'));
    await user.type(within(dialog).getByLabelText('Base price'), '142.5');
    await user.click(within(dialog).getByRole('button', { name: 'Add stock' }));

    await waitFor(() => {
      expect(writes(calls)).toEqual([
        expect.objectContaining({
          method: 'POST',
          path: 'admin/stocks',
          body: expect.objectContaining({
            symbol: 'NVDA',
            basePrice: 142.5,
            volatility: 1,
            isEnabled: true,
          }) as unknown,
        }),
      ]);
    });
  });

  it('offers to disable a stock the server refuses to delete', async () => {
    const { calls } = renderStocks();

    await userEvent.click(await screen.findByRole('button', { name: 'Actions for AAPL' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Delete stock' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete stock' }));

    expect(
      await screen.findByRole('dialog', { name: "AAPL can't be deleted" }),
    ).toBeInTheDocument();
    expect(writes(calls)).toEqual([
      expect.objectContaining({ method: 'DELETE', path: 'admin/stocks/AAPL' }),
    ]);
    await userEvent.click(screen.getByRole('button', { name: 'Disable instead' }));
    await waitFor(() => {
      expect(writes(calls).at(-1)).toEqual(
        expect.objectContaining({
          method: 'PATCH',
          path: 'admin/stocks/AAPL',
          body: { isEnabled: false },
        }),
      );
    });
  });

  it('disables a stock from its switch', async () => {
    const { calls } = renderStocks();

    await userEvent.click(await screen.findByRole('switch', { name: 'Disable AAPL' }));
    await waitFor(() => {
      expect(writes(calls)).toEqual([
        expect.objectContaining({ path: 'admin/stocks/AAPL', body: { isEnabled: false } }),
      ]);
    });
  });

  it('shows an empty catalogue with a first-stock action', async () => {
    renderStocks({ stocks: [] });

    expect(
      await screen.findByRole('heading', { name: 'No stocks listed yet' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add your first stock' })).toBeEnabled();
  });

  it('locks every change for viewers without hiding it', async () => {
    const { calls } = renderStocks({ role: 'VIEWER' });

    const actions = await screen.findByRole('button', { name: 'Actions for AAPL' });
    await waitFor(() => {
      expect(actions).toHaveAccessibleDescription("Viewers can't make changes");
    });
    expect(screen.getByRole('button', { name: 'Add stock' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    const toggle = screen.getByRole('switch', { name: 'Disable AAPL' });
    expect(toggle).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(toggle);
    await userEvent.click(actions);
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
    expect(writes(calls)).toEqual([]);
  });
});
