import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type InviteRow } from '@sarwa/contracts';

import { type InviteDialogView } from '../../src/features/team/invite-dialog';
import { type TeamView, TeamPage } from '../../src/features/team/team-page';
import { makeUser, NOW, renderWithProviders } from '../utils';

const maya = makeUser();
const sam = makeUser({ id: 'u2', email: 'sam@minitrading.dev', name: 'Sam Okafor' });

function makeInvite(overrides: Partial<InviteRow> = {}): InviteRow {
  return {
    id: 'i1',
    email: 'lee@minitrading.dev',
    role: 'VIEWER',
    invitedBy: 'maya@minitrading.dev',
    status: 'pending',
    createdAt: new Date(NOW - 3_600_000).toISOString(),
    expiresAt: new Date(NOW + 47 * 3_600_000).toISOString(),
    ...overrides,
  };
}

function makeInviteDialog(overrides: Partial<InviteDialogView> = {}): InviteDialogView {
  return {
    open: false,
    email: '',
    role: 'VIEWER',
    emailInvalid: false,
    isSending: false,
    failed: false,
    validHours: 48,
    actions: {
      open: jest.fn(),
      close: jest.fn(),
      setEmail: jest.fn(),
      setRole: jest.fn(),
      submit: jest.fn(),
    },
    ...overrides,
  };
}

function makeView(overrides: Partial<TeamView> = {}): TeamView {
  return {
    me: maya,
    forbidden: false,
    canEdit: true,
    members: [
      { user: maya, you: true, locked: true },
      { user: sam, you: false, locked: false },
    ],
    counts: { total: 2, admins: 2, viewers: 0 },
    status: 'ready',
    search: '',
    filter: 'all',
    failed: false,
    now: NOW,
    confirm: { request: null, isSaving: false, failed: false },
    invites: {
      rows: [
        makeInvite(),
        makeInvite({ id: 'i2', email: 'old@minitrading.dev', status: 'expired' }),
      ],
      status: 'ready',
      revoking: null,
      resendingId: null,
      isRevoking: false,
      revokeFailed: false,
    },
    invite: makeInviteDialog(),
    actions: {
      retry: jest.fn(),
      search: jest.fn(),
      setFilter: jest.fn(),
      setRole: jest.fn(),
      setStatus: jest.fn(),
      confirm: jest.fn(),
      cancelConfirm: jest.fn(),
      retryInvites: jest.fn(),
      resend: jest.fn(),
      askRevoke: jest.fn(),
      confirmRevoke: jest.fn(),
      cancelRevoke: jest.fn(),
    },
    ...overrides,
  };
}

describe('TeamPage', () => {
  it('lists admin staff without a 2FA column and locks your own row', async () => {
    const view = makeView();
    renderWithProviders(<TeamPage view={view} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Team' })).toBeInTheDocument();
    expect(screen.getByText(/^Admin staff only · 2 accounts/)).toBeInTheDocument();
    const members = screen.getByRole('table', { name: 'Team' });
    expect(within(members).queryByText('2FA')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Role for maya@minitrading.dev' })).toBeDisabled();
    const [, mine, sams] = within(members).getAllByRole('row');
    expect(within(mine!).getByRole('button', { name: 'Disable' })).toBeDisabled();

    await userEvent.click(within(sams!).getByRole('button', { name: 'Disable' }));
    expect(view.actions.setStatus).toHaveBeenCalledWith('u2', 'disabled');
  });

  it('shows pending and expired invites and confirms before revoking one', async () => {
    const view = makeView();
    const { rerender } = renderWithProviders(<TeamPage view={view} />);

    const invites = screen.getByRole('table', { name: 'Pending invites' });
    const [, pending, expired] = within(invites).getAllByRole('row');
    expect(pending).toHaveTextContent('lee@minitrading.dev');
    expect(pending).toHaveTextContent('in 2 days');
    expect(pending).not.toHaveTextContent('Expired');
    expect(expired).toHaveTextContent('Expired');
    await userEvent.click(
      within(pending!).getByRole('button', {
        name: 'Revoke the invite for lee@minitrading.dev',
      }),
    );
    expect(view.actions.askRevoke).toHaveBeenCalledWith('i1');

    const revoking = makeView({ invites: { ...view.invites, revoking: makeInvite() } });
    rerender(<TeamPage view={revoking} />);
    const dialog = screen.getByRole('dialog', {
      name: 'Revoke the invite for lee@minitrading.dev?',
    });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Revoke' }));
    expect(revoking.actions.confirmRevoke).toHaveBeenCalled();
  });

  it('invites an admin by email and role with a 48-hour link', async () => {
    const invite = makeInviteDialog({ open: true, email: 'sam', emailInvalid: true });
    const view = makeView({ invite });
    renderWithProviders(<TeamPage view={view} />);

    const dialog = screen.getByRole('dialog', { name: 'Invite admin' });
    expect(dialog).toHaveTextContent('They’ll get an email link valid for 48 hours.');
    const email = within(dialog).getByLabelText('Work email');
    expect(email).toHaveAccessibleDescription(
      'Enter a full email address, e.g. sam@minitrading.dev',
    );
    await userEvent.type(email, '@');
    expect(invite.actions.setEmail).toHaveBeenCalledWith('sam@');
    await userEvent.click(within(dialog).getByRole('radio', { name: /ADMIN/ }));
    expect(invite.actions.setRole).toHaveBeenCalledWith('ADMIN');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Send invite' }));
    expect(invite.actions.submit).toHaveBeenCalled();
  });

  it('shows viewers the 403 page', () => {
    renderWithProviders(
      <TeamPage view={makeView({ forbidden: true, me: makeUser({ role: 'VIEWER' }) })} />,
    );

    expect(
      screen.getByRole('heading', { name: "You don't have access to Team" }),
    ).toBeInTheDocument();
  });
});
