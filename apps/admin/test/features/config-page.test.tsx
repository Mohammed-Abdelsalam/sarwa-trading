import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type AppConfig, PERIODS } from '@sarwa/contracts';

import { ConfigPage } from '../../src/features/config/config-page';
import { makeStats, me, renderWithApi } from '../utils';

const config = (overrides: Partial<AppConfig> = {}): AppConfig => ({
  maintenanceMode: false,
  banner: null,
  enabledPeriods: [...PERIODS],
  updatedAt: 1,
  ...overrides,
});

describe('ConfigPage', () => {
  it('saves only the fields this admin edited, keeping changes another admin saved meanwhile', async () => {
    const server = { config: config() };
    const { calls, queryClient } = renderWithApi(<ConfigPage />, {
      'GET admin/auth/me': me(),
      'GET admin/stats': makeStats(),
      'GET app-config': () => server.config,
      'PATCH admin/config': () => server.config,
    });

    await userEvent.click(await screen.findByRole('switch', { name: 'Maintenance mode' }));
    server.config = config({
      banner: { message: 'Close at 1pm', tone: 'warning' },
      enabledPeriods: ['1D'],
    });
    await act(() => queryClient.invalidateQueries());

    await waitFor(() => {
      expect(screen.getByLabelText('Message')).toHaveValue('Close at 1pm');
    });
    expect(screen.getByRole('button', { name: '1D' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '1W' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('● 1 unsaved changes')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Save & enable maintenance' }));
    await waitFor(() => {
      expect(calls.filter((call) => call.method === 'PATCH')).toEqual([
        expect.objectContaining({ path: 'admin/config', body: { maintenanceMode: true } }),
      ]);
    });
  });
});
