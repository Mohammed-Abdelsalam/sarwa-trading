import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useAdminAccounts, useAdminSession, useResetAccount } from '@sarwa/core/admin';

import { AccountsPage } from '../../src/features/accounts/accounts-page';
import { makeAccount, mutation, query, renderWithProviders, session } from '../utils';

jest.mock('@sarwa/core/admin', () => ({
  ...jest.requireActual<object>('@sarwa/core/admin'),
  useAdminSession: jest.fn(),
  useAdminAccounts: jest.fn(),
  useResetAccount: jest.fn(),
}));

function setup(role: 'ADMIN' | 'VIEWER' = 'ADMIN') {
  const reset = mutation();
  jest.mocked(useAdminSession).mockReturnValue(session(role));
  jest
    .mocked(useAdminAccounts)
    .mockReturnValue(query({ items: [makeAccount()], total: 1, page: 1, pageSize: 25 }));
  jest.mocked(useResetAccount).mockReturnValue(reset as never);
  renderWithProviders(<AccountsPage />);
  return reset;
}

describe('AccountsPage', () => {
  it('lists accounts with formatted balances', () => {
    setup();

    expect(screen.getByText('ACC-00AA11')).toBeInTheDocument();
    expect(screen.getByText('$110,194.29')).toBeInTheDocument();
    expect(screen.getByText('+$647.32')).toBeInTheDocument();
  });

  it('only resets after the exact confirmation phrase is typed', async () => {
    const reset = setup();

    await userEvent.click(screen.getByRole('button', { name: 'View ACC-00AA11' }));
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

    await userEvent.click(confirm);
    expect(reset.mutate).toHaveBeenCalledWith(
      { id: 'acc-1', confirm: 'RESET ACC-00AA11' },
      expect.anything(),
    );
  });

  it('locks the reset for viewers', async () => {
    setup('VIEWER');

    await userEvent.click(screen.getByRole('button', { name: 'View ACC-00AA11' }));

    expect(screen.getByRole('button', { name: 'Reset account' })).toBeDisabled();
  });
});
