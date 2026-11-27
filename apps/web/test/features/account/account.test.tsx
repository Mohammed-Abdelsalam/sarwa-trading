import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type SessionInfo } from '@sarwa/contracts';

import { DangerSettingsPage } from '../../../src/features/account/danger-zone';
import { SecuritySettingsPage } from '../../../src/features/account/security-card';
import { SuspendedPage } from '../../../src/features/account/suspended-page';
import { type DangerPageView } from '../../../src/features/account/use-danger-page';
import { type SecurityPageView } from '../../../src/features/account/use-security-page';
import { VerifyEmailBanner } from '../../../src/features/account/verify-email-banner';
import { providers } from '../../copy';
import { goodPassword } from '../auth/auth-fixtures';

const NOW = Date.UTC(2026, 10, 27, 15);
const DAY = 86_400_000;

function session(overrides: Partial<SessionInfo>): SessionInfo {
  return {
    id: 's1',
    label: 'Chrome on macOS',
    platform: 'web',
    browser: 'Chrome',
    os: 'macOS',
    ipMasked: '41.32.•.•',
    lastActiveAt: NOW,
    createdAt: NOW - 30 * DAY,
    current: false,
    ...overrides,
  };
}

const sessions = [
  session({ id: 'here', current: true }),
  session({
    id: 'phone',
    platform: 'ios',
    model: 'iPhone 15',
    label: 'Mini Trading for iOS · iPhone 15',
    browser: undefined,
    os: undefined,
    ipMasked: '156.204.•.•',
    lastActiveAt: NOW - 12 * 60_000,
  }),
  session({ id: 'pc', browser: 'Firefox', os: 'Windows', lastActiveAt: NOW - 2 * DAY }),
];

function securityView(overrides: Partial<SecurityPageView> = {}): SecurityPageView {
  return {
    now: NOW,
    profile: {
      user: {
        id: 'u1',
        email: 'sara.h@example.com',
        name: 'Sara Hassan',
        emailVerified: true,
        createdAt: Date.UTC(2026, 9, 2, 12),
        passwordChangedAt: NOW - 34 * DAY,
        account: { id: 'a1', handle: 'ACC-7F2K9Q' },
      },
      resend: 'idle',
      edit: { open: false, name: 'Sara Hassan', isPending: false },
      actions: {
        resendVerification: jest.fn(),
        openEdit: jest.fn(),
        closeEdit: jest.fn(),
        setName: jest.fn(),
        saveName: jest.fn(),
      },
    },
    password: {
      open: false,
      values: { current: '', next: '', confirm: '' },
      errors: {},
      currentIncorrect: false,
      password: goodPassword,
      matches: false,
      problem: null,
      isPending: false,
      actions: {
        open: jest.fn(),
        cancel: jest.fn(),
        setCurrent: jest.fn(),
        setNext: jest.fn(),
        setConfirm: jest.fn(),
        submit: jest.fn(),
      },
    },
    sessions: {
      status: 'ready',
      items: sessions,
      revokingId: null,
      confirmOthers: false,
      isRevokingOthers: false,
      actions: {
        revoke: jest.fn(),
        askSignOutOthers: jest.fn(),
        cancelSignOutOthers: jest.fn(),
        confirmSignOutOthers: jest.fn(),
        retry: jest.fn(),
      },
    },
    ...overrides,
  };
}

function dangerView(overrides: Partial<DangerPageView> = {}): DangerPageView {
  return {
    summary: { equityCents: 11_019_429, openOrders: 3, watchlist: 7, alerts: 4, positions: 5 },
    dialog: 'none',
    isSigningOut: false,
    deletion: { password: '', confirm: '', errors: {}, passwordIncorrect: false, isPending: false },
    reset: { confirm: '', isPending: false },
    actions: {
      signOut: jest.fn(),
      open: jest.fn(),
      close: jest.fn(),
      setDeletePassword: jest.fn(),
      setDeleteConfirm: jest.fn(),
      submitDelete: jest.fn(),
      setResetConfirm: jest.fn(),
      submitReset: jest.fn(),
    },
    ...overrides,
  };
}

const wrapper = providers().wrapper;

describe('Settings navigation', () => {
  it('lists every section and marks the current one', () => {
    render(<SecuritySettingsPage view={securityView()} />, { wrapper });
    const nav = screen.getByRole('navigation', { name: 'Settings' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual([
      'Profile',
      'Security',
      'Notifications',
      'Appearance',
      'Trading',
      'Danger zone',
    ]);
    expect(within(nav).getByRole('link', { name: 'Security' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Profile' })).toHaveAttribute(
      'href',
      '/settings/security#profile',
    );
  });

  it('reads in Arabic', () => {
    render(<SecuritySettingsPage view={securityView()} />, {
      wrapper: providers({ locale: 'ar' }).wrapper,
    });
    expect(screen.getByRole('link', { name: 'منطقة الخطر' })).toBeVisible();
    expect(screen.getByText('هذا الجهاز')).toBeVisible();
  });
});

describe('ProfileCard', () => {
  it('shows the verified email, account id and practice account', () => {
    render(<SecuritySettingsPage view={securityView()} />, { wrapper });
    expect(screen.getByText('Sara Hassan')).toBeVisible();
    expect(screen.getByText('Verified')).toBeVisible();
    expect(screen.getByText('ACC-7F2K9Q')).toBeVisible();
    expect(screen.getByText('$100,000 start · Paper')).toBeVisible();
  });

  it('offers a resend while unverified', async () => {
    const view = securityView();
    view.profile.user.emailVerified = false;
    render(<SecuritySettingsPage view={view} />, { wrapper });
    expect(screen.getByText('Unverified')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Resend' }));
    expect(view.profile.actions.resendVerification).toHaveBeenCalledTimes(1);
  });

  it('edits the name in a dialog', async () => {
    const view = securityView();
    view.profile.edit = {
      open: true,
      name: '',
      error: { code: 'NAME_REQUIRED' },
      isPending: false,
    };
    render(<SecuritySettingsPage view={view} />, { wrapper });
    const dialog = screen.getByRole('dialog', { name: 'Edit profile' });
    expect(within(dialog).getByLabelText('Name')).toHaveAccessibleDescription('Enter your name');
    await userEvent.type(within(dialog).getByLabelText('Name'), 'S');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(view.profile.actions.setName).toHaveBeenCalledWith('S');
    expect(view.profile.actions.saveName).toHaveBeenCalledTimes(1);
  });
});

describe('SecurityCard', () => {
  it('says when the password changed and opens the inline form', async () => {
    const view = securityView();
    render(<SecuritySettingsPage view={view} />, { wrapper });
    expect(screen.getByText('Last changed 34 days ago')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));
    expect(view.password.actions.open).toHaveBeenCalledTimes(1);
  });

  it('flags a wrong current password and returns focus when closed', () => {
    const view = securityView();
    view.password = {
      ...view.password,
      open: true,
      values: { current: 'nope', next: 'Tr4ding!sFun', confirm: 'Tr4ding!sFun' },
      currentIncorrect: true,
      matches: true,
    };
    const { rerender } = render(<SecuritySettingsPage view={view} />, { wrapper });
    const current = screen.getByLabelText('Current password');
    expect(current).toHaveAttribute('aria-invalid', 'true');
    expect(current).toHaveAccessibleDescription('Current password is incorrect.');
    expect(screen.getByLabelText('Confirm new password')).toHaveAccessibleDescription(
      'Passwords match ✓',
    );
    expect(screen.getByText('Changing your password signs out every other device.')).toBeVisible();

    rerender(
      <SecuritySettingsPage view={{ ...view, password: { ...view.password, open: false } }} />,
    );
    expect(screen.getByRole('button', { name: 'Change password' })).toHaveFocus();
  });

  it('lists sessions with this device first and no sign out on it', async () => {
    const view = securityView();
    render(<SecuritySettingsPage view={view} />, { wrapper });
    expect(screen.getByText('3 devices · IP addresses are partly hidden')).toBeVisible();
    const rows = within(screen.getByRole('region', { name: 'Active sessions' })).getAllByRole(
      'listitem',
    );
    expect(rows[0]).toHaveTextContent('Chrome on macOSThis device41.32.•.• · Active now');
    expect(within(rows[0]!).queryByRole('button')).not.toBeInTheDocument();
    expect(rows[1]).toHaveTextContent('Mini Trading for iOS · iPhone 15156.204.•.• · 12 min ago');
    await userEvent.click(
      screen.getByRole('button', { name: 'Sign out Mini Trading for iOS · iPhone 15' }),
    );
    expect(view.sessions.actions.revoke).toHaveBeenCalledWith('phone');
  });

  it('confirms signing out every other device', async () => {
    const view = securityView();
    view.sessions.confirmOthers = true;
    render(<SecuritySettingsPage view={view} />, { wrapper });
    const dialog = screen.getByRole('dialog', { name: 'Sign out of all other devices?' });
    expect(dialog).toHaveTextContent(
      '2 sessions will end within a few seconds: Mini Trading for iOS · iPhone 15 and Firefox on Windows.',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Sign out 2 devices' }));
    expect(view.sessions.actions.confirmSignOutOthers).toHaveBeenCalledTimes(1);
  });

  it('retries a failed sessions load', async () => {
    const view = securityView();
    view.sessions.status = 'error';
    render(<SecuritySettingsPage view={view} />, { wrapper });
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load your sessions");
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(view.sessions.actions.retry).toHaveBeenCalledTimes(1);
  });

  it('marks two-factor as coming soon', () => {
    render(<SecuritySettingsPage view={securityView()} />, { wrapper });
    expect(screen.getByText('Two-factor authentication & passkeys')).toBeVisible();
    expect(screen.getByText('Coming soon')).toBeVisible();
  });
});

describe('DangerZone', () => {
  it('offers sign out, reset and delete', async () => {
    const view = dangerView();
    render(<DangerSettingsPage view={view} />, { wrapper });
    expect(screen.getByRole('link', { name: 'Danger zone' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await userEvent.click(screen.getByRole('button', { name: 'Reset…' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete account…' }));
    expect(view.actions.signOut).toHaveBeenCalledTimes(1);
    expect(view.actions.open).toHaveBeenNthCalledWith(1, 'reset');
    expect(view.actions.open).toHaveBeenNthCalledWith(2, 'delete');
    expect(
      screen.getByText(
        'Permanently deletes your profile, practice portfolio, watchlists and alerts after 7 days.',
      ),
    ).toBeVisible();
  });

  it('deletes only with the password and DELETE typed exactly', async () => {
    const view = dangerView({ dialog: 'delete' });
    const { rerender } = render(<DangerSettingsPage view={view} />, { wrapper });
    const dialog = screen.getByRole('dialog', { name: 'Delete your account?' });
    expect(dialog).toHaveAccessibleDescription(
      'Your practice portfolio ($110,194.29), 3 open orders, a 7-stock watchlist and 4 alerts will be deleted. You can cancel within 7 days by signing in.',
    );
    expect(within(dialog).getByRole('button', { name: 'Delete account' })).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText('Type DELETE to confirm'), 'd');
    expect(view.actions.setDeleteConfirm).toHaveBeenCalledWith('d');

    rerender(
      <DangerSettingsPage
        view={{ ...view, deletion: { ...view.deletion, password: 'secret', confirm: 'delete' } }}
      />,
    );
    expect(screen.getByRole('button', { name: 'Delete account' })).toBeDisabled();

    rerender(
      <DangerSettingsPage
        view={{ ...view, deletion: { ...view.deletion, password: 'secret', confirm: 'DELETE' } }}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Delete account' }));
    expect(view.actions.submitDelete).toHaveBeenCalledTimes(1);
  });

  it('flags a wrong password on delete', () => {
    const view = dangerView({ dialog: 'delete' });
    view.deletion.passwordIncorrect = true;
    render(<DangerSettingsPage view={view} />, { wrapper });
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription(
      'Current password is incorrect.',
    );
  });

  it('resets after RESET is typed and shows the before and after equity', async () => {
    const view = dangerView({ dialog: 'reset', reset: { confirm: 'RESET', isPending: false } });
    render(<DangerSettingsPage view={view} />, { wrapper });
    const dialog = screen.getByRole('dialog', { name: 'Reset practice account?' });
    expect(dialog).toHaveAccessibleDescription(
      'Closes 5 positions at last price, cancels 3 open orders and restores $100,000.00. Order history is kept.',
    );
    expect(within(dialog).getByText('$110,194.29')).toBeVisible();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reset account' }));
    expect(view.actions.submitReset).toHaveBeenCalledTimes(1);
  });
});

describe('SuspendedPage', () => {
  it('shows the reason, support and the reference', async () => {
    const signOut = jest.fn();
    render(
      <SuspendedPage
        view={{
          suspension: {
            reasonCategory: 'abuse',
            reason: 'Automated scripts placing orders faster than the fair-use limit.',
            at: NOW,
            accountHandle: 'ACC-7F2K9Q',
          },
          supportHref: 'mailto:support@example.com',
          actions: { signOut },
        }}
      />,
      { wrapper },
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'Your account is suspended' }),
    ).toBeVisible();
    expect(
      screen.getByText(
        '“Automated scripts placing orders faster than the fair-use limit.” · Nov 27',
      ),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Contact support' })).toHaveAttribute(
      'href',
      'mailto:support@example.com',
    );
    expect(
      screen.getByText('Reference ACC-7F2K9Q · You can still browse markets as a guest.'),
    ).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});

describe('VerifyEmailBanner', () => {
  it('asks to verify, resends and dismisses', async () => {
    const actions = { resend: jest.fn(), dismiss: jest.fn() };
    render(<VerifyEmailBanner view={{ email: 'sara.h@example.com', resend: 'idle', actions }} />, {
      wrapper,
    });
    expect(
      screen.getByText(
        'Verify your email to secure your account — we sent a link to sara.h@example.com.',
      ),
    ).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Resend' }));
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss verify-email message' }));
    expect(actions.resend).toHaveBeenCalledTimes(1);
    expect(actions.dismiss).toHaveBeenCalledTimes(1);
  });

  it('hides without an email to verify', () => {
    const { container } = render(
      <VerifyEmailBanner
        view={{ email: null, resend: 'idle', actions: { resend: jest.fn(), dismiss: jest.fn() } }}
      />,
      { wrapper },
    );
    expect(container).toBeEmptyDOMElement();
  });
});
