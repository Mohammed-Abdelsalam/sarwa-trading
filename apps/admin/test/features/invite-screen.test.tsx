import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';

import { InviteScreen } from '../../src/features/invite/invite-page';
import { HttpError, makeUser, NOW, renderWithApi, type Routes } from '../utils';

const TOKEN = 'tok_0123456789abcdef';

function renderInvite(routes: Routes = {}) {
  window.history.replaceState(null, '', `/invite/${TOKEN}`);
  return renderWithApi(<InviteScreen token={TOKEN} />, {
    [`GET admin/invites/token/${TOKEN}`]: {
      email: 'lee@minitrading.dev',
      role: 'VIEWER',
      expiresAt: new Date(NOW).toISOString(),
    },
    'POST admin/invites/accept': {
      user: makeUser({ id: 'u3', email: 'lee@minitrading.dev', role: 'VIEWER' }),
    },
    ...routes,
  });
}

describe('Invite screen', () => {
  it('shows an expired link without ever sending the invitee to sign in', async () => {
    const { admin } = renderInvite({ [`GET admin/invites/token/${TOKEN}`]: new HttpError(410) });

    expect(await screen.findByText('This invite has expired')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute('href', '/login');
    expect(admin.toLogin).not.toHaveBeenCalled();
    expect(useRouter().replace).not.toHaveBeenCalled();
  });

  it('checks the name and password before joining, then opens the dashboard', async () => {
    const { calls } = renderInvite();

    expect(
      await screen.findByText(/You were invited as VIEWER with lee@minitrading\.dev/),
    ).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Password'), 'password');
    await userEvent.click(screen.getByRole('button', { name: 'Create admin account' }));
    expect(screen.getByText('Enter your name')).toBeInTheDocument();
    expect(
      screen.getByText('This password is too common — try a longer phrase'),
    ).toBeInTheDocument();
    expect(calls.map((call) => call.method)).not.toContain('POST');

    await userEvent.type(screen.getByLabelText('Full name'), 'Lee Chen');
    await userEvent.clear(screen.getByLabelText('Password'));
    await userEvent.type(screen.getByLabelText('Password'), 'Correct-Horse-42');
    expect(screen.getByText('Strong')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Create admin account' }));

    await waitFor(() => {
      expect(useRouter().replace).toHaveBeenCalledWith('/overview');
    });
    expect(calls.find((call) => call.method === 'POST')?.body).toEqual({
      token: TOKEN,
      name: 'Lee Chen',
      password: 'Correct-Horse-42',
    });
  });

  it('keeps the form and says so when joining fails', async () => {
    renderInvite({ 'POST admin/invites/accept': new HttpError(500) });

    await userEvent.type(await screen.findByLabelText('Full name'), 'Lee Chen');
    await userEvent.type(screen.getByLabelText('Password'), 'Correct-Horse-42');
    await userEvent.click(screen.getByLabelText('Show password'));
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
    await userEvent.click(screen.getByRole('button', { name: 'Create admin account' }));

    expect(await screen.findByText(/That didn't go through/)).toBeInTheDocument();
    expect(useRouter().replace).not.toHaveBeenCalled();
  });
});
