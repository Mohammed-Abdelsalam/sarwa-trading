import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type AdminUser } from '@sarwa/contracts';

import { MarketPage } from '../../src/features/market/market-page';
import { TeamScreen } from '../../src/features/team/team-page';
import { type ApiCall, makeStats, makeUser, me, renderWithApi } from '../utils';

const writes = (calls: ApiCall[]) => calls.filter((call) => call.method !== 'GET');

function renderMarket(role: AdminUser['role']) {
  return renderWithApi(<MarketPage />, {
    'GET admin/auth/me': me(role),
    'GET admin/stats': makeStats(),
    'GET stocks': { items: [] },
    'POST admin/market': (call: ApiCall) => ({
      status: {
        state: (call.body as { action: string }).action === 'pause' ? 'paused' : 'running',
        volatility: 1.5,
        since: 2_000,
      },
      dropped: 1_284,
    }),
  });
}

describe('Market control room', () => {
  it('pauses the market and drops connections only after typing DROP', async () => {
    const { calls } = renderMarket('ADMIN');

    await userEvent.click(await screen.findByRole('button', { name: 'Pause market' }));
    await waitFor(() => {
      expect(writes(calls)).toEqual([expect.objectContaining({ body: { action: 'pause' } })]);
    });

    await userEvent.click(screen.getByRole('button', { name: 'Drop all connections' }));
    const drop = screen.getByRole('button', { name: 'Drop connections' });
    await userEvent.type(screen.getByLabelText('Type DROP to confirm'), 'DRO');
    expect(drop).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Type DROP to confirm'), 'P');
    await userEvent.click(drop);
    await waitFor(() => {
      expect(writes(calls).at(-1)).toEqual(
        expect.objectContaining({
          path: 'admin/market',
          body: { action: 'dropConnections', confirm: 'DROP' },
        }),
      );
    });
  });

  it('shows viewers the same controls, focusable but locked with an explanation', async () => {
    const { calls } = renderMarket('VIEWER');

    expect(await screen.findByText('View-only access.')).toBeInTheDocument();
    expect(screen.getByText('Read-only')).toBeInTheDocument();
    await screen.findByRole('button', { name: 'Pause market' });
    for (const name of ['Pause market', 'Drop all connections']) {
      const button = screen.getByRole('button', { name });
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).toHaveAccessibleDescription("Viewers can't make changes");
      await userEvent.click(button);
    }
    const slider = screen.getByRole('slider');
    act(() => {
      slider.focus();
    });
    expect(slider).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(writes(calls)).toEqual([]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('Team', () => {
  const sam = makeUser({ id: 'u2', email: 'sam@minitrading.dev', name: 'Sam Okafor' });
  const lee = makeUser({
    id: 'u3',
    email: 'lee@minitrading.dev',
    name: 'Lee Chen',
    role: 'VIEWER',
    status: 'disabled',
  });

  function renderUsers(role: AdminUser['role'], users: AdminUser[]) {
    return renderWithApi(<TeamScreen />, {
      'GET admin/auth/me': me(role),
      'GET admin/users': { items: users },
      'GET admin/invites': { items: [] },
      'PATCH admin/users/u2': (call: ApiCall) => ({ ...sam, ...(call.body as object) }),
      'PATCH admin/users/u3': (call: ApiCall) => ({ ...lee, ...(call.body as object) }),
    });
  }

  it('shows viewers the 403 page and never asks for the list', async () => {
    const { calls } = renderUsers('VIEWER', []);

    expect(
      await screen.findByRole('heading', { name: "You don't have access to Team" }),
    ).toBeInTheDocument();
    expect(screen.getByText('ERROR 403')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to overview' })).toHaveAttribute(
      'href',
      '/overview',
    );
    expect(calls.map((call) => call.path)).not.toContain('admin/users');
    expect(calls.map((call) => call.path)).not.toContain('admin/invites');
  });

  it('locks your own row and disables another user after confirming', async () => {
    const { calls } = renderUsers('ADMIN', [makeUser(), { ...sam, role: 'VIEWER' }]);

    expect(
      await screen.findByRole('button', { name: 'Role for maya@minitrading.dev' }),
    ).toBeDisabled();
    await userEvent.click(screen.getAllByRole('button', { name: 'Disable' })[1]!);
    expect(writes(calls)).toEqual([]);
    const dialog = screen.getByRole('dialog', { name: 'Disable sam@minitrading.dev?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Disable user' }));

    await waitFor(() => {
      expect(writes(calls)).toEqual([
        expect.objectContaining({
          method: 'PATCH',
          path: 'admin/users/u2',
          body: { status: 'disabled' },
        }),
      ]);
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('asks before demoting an ADMIN but promotes and re-enables right away', async () => {
    const { calls } = renderUsers('ADMIN', [makeUser(), sam, lee]);
    const patches = () => writes(calls).map((call) => [call.path, call.body]);

    await userEvent.click(
      await screen.findByRole('button', { name: 'Role for sam@minitrading.dev' }),
    );
    await userEvent.click(await screen.findByRole('menuitem', { name: /VIEWER/ }));
    expect(patches()).toEqual([]);
    const dialog = screen.getByRole('dialog', { name: 'Make sam@minitrading.dev a VIEWER?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Change role' }));
    await waitFor(() => {
      expect(patches()).toEqual([['admin/users/u2', { role: 'VIEWER' }]]);
    });

    await userEvent.click(screen.getByRole('button', { name: 'Role for lee@minitrading.dev' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /ADMIN/ }));
    await waitFor(() => {
      expect(patches().at(-1)).toEqual(['admin/users/u3', { role: 'ADMIN' }]);
    });
    await userEvent.click(screen.getByRole('button', { name: 'Re-enable' }));
    await waitFor(() => {
      expect(patches().at(-1)).toEqual(['admin/users/u3', { status: 'active' }]);
    });
  });
});
