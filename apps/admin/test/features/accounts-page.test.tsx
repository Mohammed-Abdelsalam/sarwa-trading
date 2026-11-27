import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type AdminUser } from '@sarwa/contracts';

import { AccountsPage } from '../../src/features/accounts/accounts-page';
import { type ApiCall, makeAccount, me, renderWithApi } from '../utils';

function setup(role: AdminUser['role'] = 'ADMIN') {
  return renderWithApi(<AccountsPage />, {
    'GET admin/auth/me': me(role),
    'GET admin/accounts': { items: [makeAccount()], total: 1, page: 1, pageSize: 25 },
    'POST admin/accounts/acc-1/reset': {
      id: 'acc-1',
      handle: 'ACC-00AA11',
      cashCents: 10_000_000,
      startingCashCents: 10_000_000,
      createdAt: 1_000,
      resetAt: 2_000,
    },
  });
}

const resets = (calls: ApiCall[]) => calls.filter((call) => call.method === 'POST');

describe('AccountsPage', () => {
  it('lists accounts with formatted balances', async () => {
    setup();

    expect(await screen.findByText('ACC-00AA11')).toBeInTheDocument();
    expect(screen.getByText('$110,194.29')).toBeInTheDocument();
    expect(screen.getByText('+$647.32')).toBeInTheDocument();
  });

  it('only resets after the exact confirmation phrase is typed', async () => {
    const { calls } = setup();

    await userEvent.click(await screen.findByRole('button', { name: 'View ACC-00AA11' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reset account' }));
    const dialog = screen.getByRole('dialog', { name: 'Reset account' });
    const input = within(dialog).getByLabelText('Type RESET ACC-00AA11 to confirm');
    const confirm = within(dialog).getByRole('button', { name: 'Reset account' });

    expect(confirm).toBeDisabled();
    await userEvent.type(input, 'reset acc-00aa11');
    expect(confirm).toBeDisabled();
    await userEvent.clear(input);
    await userEvent.type(input, 'RESET ACC-00AA11');
    expect(confirm).toBeEnabled();
    expect(resets(calls)).toEqual([]);

    await userEvent.click(confirm);
    expect(await screen.findByText('ACC-00AA11 was reset.')).toBeInTheDocument();
    expect(resets(calls)).toEqual([
      expect.objectContaining({
        path: 'admin/accounts/acc-1/reset',
        body: { confirm: 'RESET ACC-00AA11' },
      }),
    ]);
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('locks the reset for viewers', async () => {
    setup('VIEWER');

    await userEvent.click(await screen.findByRole('button', { name: 'View ACC-00AA11' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Reset account' })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
    });
  });
});
