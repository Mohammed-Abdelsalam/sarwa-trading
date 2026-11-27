import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type InviteRow } from '@sarwa/contracts';

import { ToastHost } from '../../src/components/common/toasts';
import { TeamScreen } from '../../src/features/team/team-page';
import { type ApiCall, HttpError, makeUser, me, NOW, renderWithApi, type Routes } from '../utils';

const invite: InviteRow = {
  id: 'i1',
  email: 'lee@minitrading.dev',
  role: 'VIEWER',
  invitedBy: 'maya@minitrading.dev',
  status: 'pending',
  createdAt: new Date(NOW - 3_600_000).toISOString(),
  expiresAt: new Date(NOW + 47 * 3_600_000).toISOString(),
};
const sam = makeUser({ id: 'u2', email: 'sam@minitrading.dev', name: 'Sam Okafor' });

function renderTeam(routes: Routes = {}) {
  window.history.replaceState(null, '', '/team');
  let invites = [invite];
  return renderWithApi(
    <ToastHost>
      <TeamScreen />
    </ToastHost>,
    {
      'GET admin/auth/me': me(),
      'GET admin/users': { items: [makeUser(), sam] },
      'GET admin/invites': () => ({ items: invites }),
      'POST admin/invites': (call: ApiCall) => {
        const created = { ...invite, id: 'i2', ...(call.body as object) };
        invites = [...invites, created];
        return { invite: created };
      },
      'POST admin/invites/i1/resend': () => {
        invites = [{ ...invite, id: 'i3' }];
        return { invite: invites[0] };
      },
      'DELETE admin/invites/i1': () => {
        invites = invites.filter((row) => row.id !== 'i1');
        return null;
      },
      ...routes,
    },
  );
}

const writes = (calls: ApiCall[]) =>
  calls.filter((call) => call.method !== 'GET').map((call) => [call.method, call.path, call.body]);

describe('Team screen', () => {
  it('invites by email after checking the address, then lists the new invite', async () => {
    const { calls } = renderTeam();

    await userEvent.click(await screen.findByRole('button', { name: 'Invite admin' }));
    const dialog = screen.getByRole('dialog', { name: 'Invite admin' });
    expect(within(dialog).getByText(/valid for 48 hours/)).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText('Work email'), 'sam');
    await userEvent.click(within(dialog).getByRole('radio', { name: /ADMIN/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Send invite' }));
    expect(within(dialog).getByLabelText('Work email')).toHaveAttribute('aria-invalid', 'true');
    expect(writes(calls)).toEqual([]);

    await userEvent.type(within(dialog).getByLabelText('Work email'), '@minitrading.dev');
    await userEvent.click(screen.getByRole('button', { name: 'Send invite' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(writes(calls)).toEqual([
      ['POST', 'admin/invites', { email: 'sam@minitrading.dev', role: 'ADMIN' }],
    ]);
    expect(screen.getByRole('status')).toHaveTextContent('Invite sent to sam@minitrading.dev');
    const invites = screen.getByRole('table', { name: 'Pending invites' });
    expect(await within(invites).findByText('sam@minitrading.dev')).toBeInTheDocument();
  });

  it('resends an invite and confirms it went out', async () => {
    const { calls } = renderTeam();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Resend the invite to lee@minitrading.dev' }),
    );

    await waitFor(() => {
      expect(writes(calls)).toEqual([['POST', 'admin/invites/i1/resend', undefined]]);
    });
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Invite sent to lee@minitrading.dev',
    );
  });

  it('revokes an invite after confirming and drops it from the list', async () => {
    const { calls } = renderTeam();

    await userEvent.click(
      await screen.findByRole('button', { name: 'Revoke the invite for lee@minitrading.dev' }),
    );
    const dialog = screen.getByRole('dialog', {
      name: 'Revoke the invite for lee@minitrading.dev?',
    });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Revoke' }));

    await waitFor(() => {
      expect(writes(calls)).toEqual([['DELETE', 'admin/invites/i1', undefined]]);
    });
    expect(await screen.findByText('No pending invites.')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Invite revoked');
  });

  it('keeps the only active ADMIN locked even when it is someone else', async () => {
    renderTeam({
      'GET admin/auth/me': me(),
      'GET admin/users': {
        items: [makeUser({ role: 'VIEWER' }), sam],
      },
    });

    expect(
      await screen.findByRole('button', { name: 'Role for sam@minitrading.dev' }),
    ).toBeDisabled();
  });

  it('offers a retry when the invites fail to load', async () => {
    renderTeam({ 'GET admin/invites': new HttpError(500) });

    expect(await screen.findByText("Couldn't load Pending invites")).toBeInTheDocument();
  });
});
