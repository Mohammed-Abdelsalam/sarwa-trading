import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode } from 'react';

import { type SessionInfo } from '@sarwa/contracts';
import { type ApiClient, type ClientAuth } from '@sarwa/core';

import { ToastHost } from '../../../src/components/layout/toast-host';
import { SettingsScreen } from '../../../src/features/account/settings-screen';
import { AuthUiProvider } from '../../../src/features/gating/auth-ui';
import { PersonalPage } from '../../../src/features/gating/personal-page';
import { providers } from '../../copy';
import { apiProblem, makeUser, testAuth } from '../../fixtures';

const router = { push: jest.fn(), replace: jest.fn() };
jest.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/settings/security',
  useSearchParams: () => new URLSearchParams(),
}));

beforeAll(() => {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;
});

beforeEach(() => {
  router.push.mockClear();
  router.replace.mockClear();
});

function accounts(auth: ClientAuth, api: Partial<ApiClient> = {}) {
  const base = providers({ api, auth });
  return function Accounts({ children }: { children: ReactNode }) {
    return (
      <base.wrapper>
        <ToastHost>
          <AuthUiProvider>{children}</AuthUiProvider>
        </ToastHost>
      </base.wrapper>
    );
  };
}

function session(overrides: Partial<SessionInfo>): SessionInfo {
  return {
    id: 'here',
    label: 'Chrome on macOS',
    platform: 'web',
    browser: 'Chrome',
    os: 'macOS',
    ipMasked: '41.32.•.•',
    lastActiveAt: Date.now(),
    createdAt: 1,
    current: true,
    ...overrides,
  };
}

const member = () => testAuth({ user: makeUser({ emailVerified: false }) });

describe('settings for a guest', () => {
  it('invites a guest to make an account instead of showing security', async () => {
    const auth = testAuth();
    render(<SettingsScreen section="security" />, { wrapper: accounts(auth) });

    expect(screen.getByText('Your portfolio lives here')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(auth.gate.getState()).toMatchObject({ isOpen: true, intent: { kind: 'portfolio' } });
  });

  it('still lets a guest choose the theme and language', () => {
    render(<SettingsScreen section="appearance" />, { wrapper: accounts(testAuth()) });

    expect(screen.getByRole('radiogroup', { name: 'Theme' })).toBeVisible();
    expect(screen.getByRole('radiogroup', { name: 'Language' })).toBeVisible();
  });

  it('shows the notification permission and the paper account details', () => {
    const { unmount } = render(<SettingsScreen section="notifications" />, {
      wrapper: accounts(testAuth()),
    });
    expect(screen.getByRole('heading', { level: 2 })).toBeVisible();
    unmount();

    render(<SettingsScreen section="trading" />, { wrapper: accounts(testAuth()) });
    expect(screen.getByRole('link', { name: 'Trading' })).toHaveAttribute('aria-current', 'page');
  });
});

describe('security settings, wired', () => {
  it('renames the profile and closes the dialog once saved', async () => {
    const auth = member();
    const updateProfile = jest.fn().mockResolvedValue(makeUser({ name: 'Sara H.' }));
    const listSessions = jest.fn().mockResolvedValue({ items: [session({})] });
    render(<SettingsScreen section="security" />, {
      wrapper: accounts(auth, { updateProfile, listSessions }),
    });
    await userEvent.click(screen.getByRole('button', { name: 'Edit profile' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit profile' });
    await userEvent.clear(within(dialog).getByLabelText('Name'));
    await userEvent.type(within(dialog).getByLabelText('Name'), 'Sara H.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(updateProfile).toHaveBeenCalledWith({ name: 'Sara H.' });
    expect(auth.session.getState().user?.name).toBe('Sara H.');
    expect(screen.getByText('Profile saved')).toBeVisible();
  });

  it('says so once the new password is saved', async () => {
    const changePassword = jest.fn().mockResolvedValue({ sessionsRevoked: 0 });
    const listSessions = jest.fn().mockResolvedValue({ items: [] });
    render(<SettingsScreen section="security" />, {
      wrapper: accounts(member(), { changePassword, listSessions }),
    });
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));
    await userEvent.type(screen.getByLabelText('Current password'), 'old-one-1');
    await userEvent.type(screen.getByLabelText('New password'), 'Tr4ding!sFun2026');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'Tr4ding!sFun2026');
    await userEvent.click(screen.getByRole('button', { name: 'Update password' }));

    expect(await screen.findByText('Password updated')).toBeVisible();
  });

  it('resends the verification email from the profile card', async () => {
    const resendVerification = jest.fn().mockResolvedValue(undefined);
    const listSessions = jest.fn().mockResolvedValue({ items: [] });
    render(<SettingsScreen section="security" />, {
      wrapper: accounts(member(), { resendVerification, listSessions }),
    });
    await userEvent.click(screen.getByRole('button', { name: 'Resend' }));

    expect(resendVerification).toHaveBeenCalledWith({});
  });

  it('flags a wrong current password inline', async () => {
    const changePassword = jest.fn().mockRejectedValue(apiProblem(400, 'INVALID_CURRENT_PASSWORD'));
    const listSessions = jest.fn().mockResolvedValue({ items: [] });
    render(<SettingsScreen section="security" />, {
      wrapper: accounts(member(), { changePassword, listSessions }),
    });
    await userEvent.click(screen.getByRole('button', { name: 'Change password' }));
    await userEvent.type(screen.getByLabelText('Current password'), 'wrong-one-1');
    await userEvent.type(screen.getByLabelText('New password'), 'Tr4ding!sFun2026');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'Tr4ding!sFun2026');
    await userEvent.click(screen.getByRole('button', { name: 'Update password' }));

    expect(await screen.findByText('Current password is incorrect.')).toBeVisible();
    expect(screen.getByLabelText('Current password')).toHaveAttribute('aria-invalid', 'true');
    expect(changePassword).toHaveBeenCalledWith({
      current: 'wrong-one-1',
      next: 'Tr4ding!sFun2026',
    });
  });

  it('lists sessions, signs one out and then every other device', async () => {
    const phone = session({
      id: 'phone',
      current: false,
      platform: 'ios',
      model: 'iPhone 15',
      label: 'Mini Trading for iOS · iPhone 15',
      browser: undefined,
      os: undefined,
    });
    const listSessions = jest.fn().mockResolvedValue({ items: [phone, session({})] });
    const revokeSession = jest.fn().mockResolvedValue(undefined);
    const signOutOthers = jest.fn().mockResolvedValue({ revoked: 1, labels: [phone.label] });
    render(<SettingsScreen section="security" />, {
      wrapper: accounts(member(), { listSessions, revokeSession, signOutOthers }),
    });

    expect(await screen.findByText('This device')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: /^Sign out Mini Trading for iOS/ }));
    expect(revokeSession).toHaveBeenCalledWith('phone');

    await userEvent.click(screen.getByRole('button', { name: 'Sign out of all other devices' }));
    const dialog = screen.getByRole('dialog', { name: 'Sign out of all other devices?' });
    await userEvent.click(within(dialog).getByRole('button', { name: /^Sign out 1 device/ }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(signOutOthers).toHaveBeenCalledTimes(1);
  });

  it('offers a retry when the sessions fail to load', async () => {
    const listSessions = jest.fn().mockRejectedValue(apiProblem(500, 'INTERNAL'));
    render(<SettingsScreen section="security" />, {
      wrapper: accounts(member(), { listSessions }),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Retry' }));

    expect(listSessions).toHaveBeenCalledTimes(2);
  });
});

describe('danger zone, wired', () => {
  const summary = { equityCents: 11_019_429, openOrders: 3, watchlist: 7, alerts: 4 };

  it('needs the right password, then schedules the deletion and leaves as a guest', async () => {
    const auth = member();
    const deleteAccount = jest
      .fn()
      .mockRejectedValueOnce(apiProblem(400, 'INVALID_CURRENT_PASSWORD'))
      .mockResolvedValueOnce({ purgeAt: 2 });
    const getMeSummary = jest.fn().mockResolvedValue(summary);
    render(<SettingsScreen section="danger" />, {
      wrapper: accounts(auth, { deleteAccount, getMeSummary }),
    });
    await userEvent.click(screen.getByRole('button', { name: 'Delete account…' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete your account?' });
    await userEvent.type(within(dialog).getByLabelText('Password'), 'practice-1234');
    await userEvent.type(within(dialog).getByLabelText(/Type DELETE/), 'DELETE');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete account' }));
    expect(await within(dialog).findByText('Current password is incorrect.')).toBeVisible();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete account' }));
    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/');
    });
    expect(deleteAccount).toHaveBeenLastCalledWith({
      password: 'practice-1234',
      confirm: 'DELETE',
    });
    expect(auth.session.getState().status).toBe('guest');
  });

  it('resets the practice account after RESET is typed', async () => {
    const selfReset = jest.fn().mockResolvedValue({ account: {} });
    const getMeSummary = jest.fn().mockResolvedValue(summary);
    render(<SettingsScreen section="danger" />, {
      wrapper: accounts(member(), { selfReset, getMeSummary }),
    });
    await userEvent.click(screen.getByRole('button', { name: 'Reset…' }));
    const dialog = screen.getByRole('dialog', { name: /Reset/ });
    await userEvent.type(within(dialog).getByLabelText(/Type RESET/), 'RESET');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reset account' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(selfReset).toHaveBeenCalledWith({ confirm: 'RESET' });
  });

  it('signs this browser out', async () => {
    const auth = member();
    const signOut = jest.fn().mockResolvedValue(undefined);
    render(<SettingsScreen section="danger" />, { wrapper: accounts(auth, { signOut }) });
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => {
      expect(auth.session.getState().status).toBe('guest');
    });
  });
});

describe('personal pages', () => {
  it('invites a guest instead of loading their orders', () => {
    render(
      <PersonalPage kind="orders">
        <p>orders table</p>
      </PersonalPage>,
      { wrapper: accounts(testAuth()) },
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Orders' })).toBeVisible();
    expect(screen.getByText('No orders yet')).toBeVisible();
    expect(screen.queryByText('orders table')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('pitches the practice portfolio and gates on the chosen tab', async () => {
    const auth = testAuth();
    render(
      <PersonalPage kind="portfolio">
        <p>books</p>
      </PersonalPage>,
      { wrapper: accounts(auth) },
    );
    await userEvent.click(screen.getByRole('button', { name: 'Create free account' }));

    expect(auth.gate.getState()).toMatchObject({ isOpen: true, intent: { kind: 'portfolio' } });
  });

  it('waits for the session, then shows the member page', () => {
    const auth = testAuth({ status: 'loading' });
    const { rerender } = render(
      <PersonalPage kind="alerts">
        <p>alerts list</p>
      </PersonalPage>,
      { wrapper: accounts(auth) },
    );
    expect(screen.getByRole('status', { name: 'Loading…' })).toBeInTheDocument();

    auth.session.getState().signIn(makeUser());
    rerender(
      <PersonalPage kind="alerts">
        <p>alerts list</p>
      </PersonalPage>,
    );
    expect(screen.getByText('alerts list')).toBeVisible();
  });
});
