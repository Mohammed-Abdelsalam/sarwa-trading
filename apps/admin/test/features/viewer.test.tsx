import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useMarketStatus } from '@sarwa/core';
import {
  useAdminSession,
  useAdminStats,
  useAdminUsers,
  useCreateUser,
  useLiveTicker,
  useMarketCommand,
  useUpdateUser,
} from '@sarwa/core/admin';

import { MarketPage } from '../../src/features/market/market-page';
import { UsersPage } from '../../src/features/users/users-page';
import { makeUser, mutation, query, renderWithProviders, session } from '../utils';

jest.mock('@sarwa/core', () => ({
  ...jest.requireActual<object>('@sarwa/core'),
  useMarketStatus: jest.fn(),
}));
jest.mock('@sarwa/core/admin', () => ({
  ...jest.requireActual<object>('@sarwa/core/admin'),
  useAdminSession: jest.fn(),
  useAdminStats: jest.fn(),
  useMarketCommand: jest.fn(),
  useLiveTicker: jest.fn(),
  useAdminUsers: jest.fn(),
  useUpdateUser: jest.fn(),
  useCreateUser: jest.fn(),
}));

function mockMarket(role: 'ADMIN' | 'VIEWER') {
  const command = mutation();
  jest.mocked(useAdminSession).mockReturnValue(session(role));
  jest.mocked(useMarketStatus).mockReturnValue({ state: 'running', volatility: 1.5, since: 1_000 });
  jest.mocked(useAdminStats).mockReturnValue(
    query({
      connectedClients: 1_284,
      market: { state: 'running', volatility: 1.5, since: 1_000, ticksPerSecond: 218 },
      recentActivity: [],
    }),
  );
  jest.mocked(useMarketCommand).mockReturnValue(command as never);
  jest.mocked(useLiveTicker).mockReturnValue({ rows: [], isLoading: false });
  return command;
}

describe('Market control room', () => {
  it('pauses the market and drops connections only after typing DROP', async () => {
    const command = mockMarket('ADMIN');
    renderWithProviders(<MarketPage />);

    await userEvent.click(screen.getByRole('button', { name: 'Pause market' }));
    expect(command.mutate).toHaveBeenCalledWith({ action: 'pause' });

    await userEvent.click(screen.getByRole('button', { name: 'Drop all connections' }));
    const drop = screen.getByRole('button', { name: 'Drop connections' });
    await userEvent.type(screen.getByLabelText('Type DROP to confirm'), 'DRO');
    expect(drop).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Type DROP to confirm'), 'P');
    await userEvent.click(drop);
    expect(command.mutate).toHaveBeenLastCalledWith(
      { action: 'dropConnections', confirm: 'DROP' },
      expect.anything(),
    );
  });

  it('shows viewers the same controls, disabled with a lock and tooltip', () => {
    mockMarket('VIEWER');
    renderWithProviders(<MarketPage />);

    expect(screen.getByText('View-only access.')).toBeInTheDocument();
    expect(screen.getByText('Read-only')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pause market' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Drop all connections' })).toBeDisabled();
    expect(screen.getByRole('slider')).toHaveAttribute('data-disabled');
    expect(screen.getAllByLabelText("Viewers can't make changes").length).toBeGreaterThanOrEqual(3);
  });
});

describe('Users', () => {
  it('shows viewers the 403 page instead of the list', () => {
    jest.mocked(useAdminSession).mockReturnValue(session('VIEWER'));
    jest.mocked(useAdminUsers).mockReturnValue(query(undefined, { isPending: true }));
    jest.mocked(useUpdateUser).mockReturnValue(mutation() as never);
    jest.mocked(useCreateUser).mockReturnValue(mutation() as never);
    renderWithProviders(<UsersPage />);

    expect(
      screen.getByRole('heading', { name: "You don't have access to Users" }),
    ).toBeInTheDocument();
    expect(screen.getByText('ERROR 403')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to overview' })).toHaveAttribute(
      'href',
      '/overview',
    );
    expect(useAdminUsers).toHaveBeenCalledWith({ enabled: false });
  });

  it('locks your own row and changes another user', async () => {
    const update = mutation();
    jest.mocked(useAdminSession).mockReturnValue(session('ADMIN'));
    jest
      .mocked(useAdminUsers)
      .mockReturnValue(
        query([
          makeUser(),
          makeUser({ id: 'u2', email: 'sam@minitrading.dev', name: 'Sam Okafor', role: 'VIEWER' }),
        ]),
      );
    jest.mocked(useUpdateUser).mockReturnValue(update as never);
    jest.mocked(useCreateUser).mockReturnValue(mutation() as never);
    renderWithProviders(<UsersPage />);

    expect(screen.getByRole('button', { name: 'Role for maya@minitrading.dev' })).toBeDisabled();
    await userEvent.click(screen.getAllByRole('button', { name: 'Disable' })[1]!);
    expect(update.mutate).toHaveBeenCalledWith({ id: 'u2', patch: { status: 'disabled' } });
  });
});
