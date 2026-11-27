import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Linking } from 'react-native';

import { type SessionInfo, type Suspension } from '@sarwa/contracts';

import { AccountTab } from '../../../src/features/account/account-tab';
import { ChangePasswordScreen } from '../../../src/features/account/change-password-screen';
import {
  DeleteAccountScreen,
  ResetAccountScreen,
} from '../../../src/features/account/danger-screens';
import { ProfileScreen } from '../../../src/features/account/profile-screen';
import { SecurityScreen } from '../../../src/features/account/security-screen';
import { SuspendedScreen } from '../../../src/features/account/session-ended';
import { useChangePasswordScreen } from '../../../src/features/account/use-change-password-screen';
import {
  useDeleteAccountScreen,
  useResetAccountScreen,
} from '../../../src/features/account/use-danger-screens';
import { useProfileScreen } from '../../../src/features/account/use-profile-screen';
import { passwordAge, useSecurityScreen } from '../../../src/features/account/use-security-screen';
import { useSuspendedScreen } from '../../../src/features/account/use-suspended-screen';
import { useToast } from '../../../src/lib/toast';
import { customer, englishCopy, mockApi, problem, renderScreen, testAuth } from '../../render';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), canGoBack: () => true, push: jest.fn(), replace: jest.fn() },
}));

const NOW = Date.UTC(2026, 10, 27, 15);
const DAY = 86_400_000;

function session(overrides: Partial<SessionInfo> = {}): SessionInfo {
  return {
    id: 's_1',
    label: 'Mini Trading for iOS · iPhone 15',
    platform: 'ios',
    ipMasked: '41.32.•.•',
    lastActiveAt: NOW,
    createdAt: NOW,
    current: true,
    ...overrides,
  };
}

const chrome = session({
  id: 's_2',
  label: 'Chrome on macOS',
  platform: 'web',
  current: false,
  lastActiveAt: NOW - 2 * 60_000,
});

const member = () => testAuth('authenticated', customer());

function Security() {
  return <SecurityScreen view={useSecurityScreen()} />;
}
function ChangePassword() {
  return <ChangePasswordScreen view={useChangePasswordScreen()} />;
}
function Delete() {
  return <DeleteAccountScreen view={useDeleteAccountScreen()} />;
}
function Reset() {
  return <ResetAccountScreen view={useResetAccountScreen()} />;
}
function Profile() {
  return <ProfileScreen view={useProfileScreen()} />;
}
function Suspended() {
  return <SuspendedScreen view={useSuspendedScreen()} />;
}

beforeEach(() => {
  jest.clearAllMocks();
  useToast.getState().hide();
});

describe('Account tab', () => {
  it('welcomes a guest with sign-up and the app settings', async () => {
    await renderScreen(<AccountTab />, { auth: testAuth() });

    expect(screen.getByText('Welcome to Mini Trading')).toBeOnTheScreen();
    expect(screen.getByText('App settings')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
    expect(router.push).toHaveBeenCalledWith('/sign-up');
    await fireEvent.press(screen.getByRole('button', { name: /Language/ }));
    expect(router.push).toHaveBeenCalledWith('/settings');
  });

  it('shows a member their profile, devices and signs them out', async () => {
    const auth = member();
    const signOut = jest.fn(() => Promise.resolve());
    await renderScreen(<AccountTab />, {
      auth,
      api: mockApi({
        signOut,
        listSessions: () => Promise.resolve({ items: [session(), chrome] }),
      }),
    });

    expect(screen.getByText('Sara Hassan')).toBeOnTheScreen();
    expect(screen.getByText('ACC-7F2A9C')).toBeOnTheScreen();
    expect(await screen.findByText('2 devices')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: /Security/ }));
    expect(router.push).toHaveBeenCalledWith('/account/security');
    await fireEvent.press(screen.getByRole('button', { name: /Personal info/ }));
    expect(router.push).toHaveBeenCalledWith('/account/profile');
    await fireEvent.press(screen.getByRole('button', { name: /Reset practice account/ }));
    expect(router.push).toHaveBeenCalledWith('/account/reset');
    await fireEvent.press(screen.getByRole('button', { name: /Delete account/ }));
    expect(router.push).toHaveBeenCalledWith('/account/delete');

    await fireEvent.press(screen.getByRole('button', { name: /Sign out/ }));
    expect(signOut).toHaveBeenCalled();
    await waitFor(() => {
      expect(auth.session.getState().status).toBe('guest');
    });
    expect(auth.session.getState().revokedReason).toBeNull();
  });

  it('keeps the paper account view when the build has no customer sign-in', async () => {
    await renderScreen(<AccountTab />);

    expect(screen.getByText('Paper account')).toBeOnTheScreen();
  });
});

describe('Security', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate'] });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('lists this phone first and signs another device out', async () => {
    const revokeSession = jest.fn(() => Promise.resolve());
    await renderScreen(<Security />, {
      auth: testAuth('authenticated', customer({ passwordChangedAt: NOW - 34 * DAY })),
      api: mockApi({
        listSessions: () => Promise.resolve({ items: [chrome, session()] }),
        revokeSession,
      }),
    });

    expect(screen.getByText('Last changed 34 days ago')).toBeOnTheScreen();
    expect(screen.getByText('Two-factor, passkeys & Face ID')).toBeOnTheScreen();
    expect(await screen.findByText('This device')).toBeOnTheScreen();
    expect(screen.getByText('41.32.•.• · 2 min ago')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Sign out Chrome on macOS' }));
    expect(revokeSession).toHaveBeenCalledWith('s_2');
    await waitFor(() => {
      expect(useToast.getState().message).toBe('Chrome on macOS was signed out');
    });
  });

  it('confirms before signing out every other device', async () => {
    const signOutOthers = jest.fn(() =>
      Promise.resolve({ revoked: 1, labels: ['Chrome on macOS'] }),
    );
    await renderScreen(<Security />, {
      auth: member(),
      api: mockApi({
        listSessions: () => Promise.resolve({ items: [session(), chrome] }),
        signOutOthers,
      }),
    });

    await fireEvent.press(
      await screen.findByRole('button', { name: 'Sign out of all other devices' }),
    );
    expect(screen.getByText('1 session are active.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Sign out 1 device' }));

    expect(signOutOthers).toHaveBeenCalled();
    await waitFor(() => {
      expect(useToast.getState().message).toBe('Signed out 1 session');
    });
  });

  it('offers a retry when sessions fail to load', async () => {
    const listSessions = jest.fn(() => Promise.reject(problem('INTERNAL', 500)));
    await renderScreen(<Security />, { auth: member(), api: mockApi({ listSessions }) });

    expect(await screen.findByText("Couldn't load your sessions")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    expect(listSessions).toHaveBeenCalledTimes(2);
    await fireEvent.press(screen.getByRole('button', { name: /Change password/ }));
    expect(router.push).toHaveBeenCalledWith('/account/change-password');
  });

  it('dates the password change', async () => {
    const copy = await englishCopy();

    expect(passwordAge(null, NOW, copy)).toBe('Set when you signed up');
    expect(passwordAge(NOW - 3_600_000, NOW, copy)).toBe('Changed today');
    expect(passwordAge(NOW - DAY, NOW, copy)).toBe('Last changed 1 day ago');
  });
});

describe('Change password', () => {
  async function fill(confirm = 'Tr4ding!sFun') {
    await fireEvent.changeText(screen.getByLabelText('Current password'), 'practice-1234');
    await fireEvent.changeText(screen.getByLabelText('New password'), 'Tr4ding!sFun');
    await fireEvent.changeText(screen.getByLabelText('Confirm new password'), confirm);
    await fireEvent.press(screen.getByRole('button', { name: 'Update password' }));
  }

  it('updates it and returns', async () => {
    const changePassword = jest.fn(() => Promise.resolve({ sessionsRevoked: 2 }));
    await renderScreen(<ChangePassword />, { auth: member(), api: mockApi({ changePassword }) });
    await fill();

    expect(changePassword).toHaveBeenCalledWith({
      current: 'practice-1234',
      next: 'Tr4ding!sFun',
    });
    expect(useToast.getState().message).toBe('Password updated');
    expect(router.back).toHaveBeenCalled();
  });

  it('shows a wrong current password and a mismatched confirmation', async () => {
    const changePassword = () => Promise.reject(problem('INVALID_CURRENT_PASSWORD', 400));
    await renderScreen(<ChangePassword />, { auth: member(), api: mockApi({ changePassword }) });
    await fill('nope');
    expect(screen.getByText("Passwords don't match")).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Confirm new password'), 'Tr4ding!sFun');
    await fireEvent.press(screen.getByRole('button', { name: 'Update password' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/Current password is incorrect\./);
  });
});

describe('Delete account', () => {
  const summary = { equityCents: 11_019_429, openOrders: 1, watchlist: 7, alerts: 2 };

  it('spells out what goes, then deletes after DELETE is typed', async () => {
    const auth = member();
    const deleteAccount = jest.fn(() => Promise.resolve({ purgeAt: Date.UTC(2026, 11, 4) }));
    await renderScreen(<Delete />, {
      auth,
      api: mockApi({ getMeSummary: () => Promise.resolve(summary), deleteAccount }),
    });

    expect(
      await screen.findByText(
        /Your practice portfolio \(\$110,194\.29\), 1 open order, a 7-stock watchlist and 2 alerts/,
      ),
    ).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Password'), 'practice-1234');
    await fireEvent.changeText(screen.getByLabelText('Type DELETE to confirm'), 'delete');
    await fireEvent.press(screen.getByRole('button', { name: 'Delete my account' }));
    expect(screen.getByText("That doesn't match — type it exactly as shown")).toBeOnTheScreen();
    expect(deleteAccount).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('Type DELETE to confirm'), 'DELETE');
    await fireEvent.press(screen.getByRole('button', { name: 'Delete my account' }));

    expect(deleteAccount).toHaveBeenCalledWith({ password: 'practice-1234', confirm: 'DELETE' });
    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/(tabs)');
    });
    expect(useToast.getState().message).toMatch(/Your account will be deleted on Dec/);
    expect(auth.session.getState().status).toBe('guest');
  });
});

describe('Reset practice account', () => {
  it('resets after RESET is typed and says so', async () => {
    const selfReset = jest.fn(() =>
      Promise.resolve({
        account: {
          id: 'a_1',
          handle: 'ACC-7F2A9C',
          cashCents: 10_000_000,
          startingCashCents: 10_000_000,
          createdAt: 0,
          resetAt: NOW,
        },
      }),
    );
    await renderScreen(<Reset />, {
      auth: member(),
      api: mockApi({
        getMeSummary: () =>
          Promise.resolve({ equityCents: 0, openOrders: 2, watchlist: 0, alerts: 0 }),
        getPortfolio: () => Promise.reject(problem('INTERNAL', 500)),
        selfReset,
      }),
    });

    expect(
      await screen.findByText(/cancels 2 open orders and restores \$100,000/),
    ).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Type RESET to confirm'), 'RESET');
    await fireEvent.press(screen.getByRole('button', { name: 'Reset account' }));

    expect(selfReset).toHaveBeenCalledWith({ confirm: 'RESET' });
    await waitFor(() => {
      expect(useToast.getState().message).toBe('Practice account reset to $100,000');
    });
  });
});

describe('Profile', () => {
  it('renames the member and resends an unverified email', async () => {
    const auth = testAuth('authenticated', customer({ emailVerified: false }));
    const updateProfile = jest.fn(() => Promise.resolve(customer({ name: 'Sara Ali' })));
    const resendVerification = jest.fn(() => Promise.resolve());
    await renderScreen(<Profile />, {
      auth,
      api: mockApi({ updateProfile, resendVerification }),
    });

    expect(screen.getByText('Unverified')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Resend' }));
    expect(resendVerification).toHaveBeenCalledWith({});
    await waitFor(() => {
      expect(useToast.getState().message).toBe('Verification email sent');
    });

    await fireEvent.changeText(screen.getByLabelText('Name'), 'Sara Ali');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(updateProfile).toHaveBeenCalledWith({ name: 'Sara Ali' });
    expect(auth.session.getState().user?.name).toBe('Sara Ali');
    expect(useToast.getState().message).toBe('Profile saved');
  });

  it('asks for a name before saving', async () => {
    const updateProfile = jest.fn();
    await renderScreen(<Profile />, { auth: member(), api: mockApi({ updateProfile }) });
    await fireEvent.changeText(screen.getByLabelText('Name'), ' ');
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByText('Enter your name')).toBeOnTheScreen();
    expect(updateProfile).not.toHaveBeenCalled();
    expect(screen.getByText('Verified')).toBeOnTheScreen();
  });
});

describe('Suspended', () => {
  const suspension: Suspension = {
    reasonCategory: 'abuse',
    reason: 'Automated scripts placing orders.',
    at: Date.UTC(2026, 10, 27, 15),
    accountHandle: 'ACC-7F2A9C',
  };

  it('shows the reason, contacts support and continues as a guest', async () => {
    const auth = testAuth();
    auth.session.getState().suspend(suspension);
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await renderScreen(<Suspended />, { auth });

    expect(screen.getByText('Automated trading scripts')).toBeOnTheScreen();
    expect(screen.getByText(/“Automated scripts placing orders\.” · Nov 27/)).toBeOnTheScreen();
    expect(screen.getByText(/Reference ACC-7F2A9C/)).toBeOnTheScreen();

    await fireEvent.press(
      screen.getByRole('button', { name: 'Contact support, support@minitrading.dev' }),
    );
    expect(openURL).toHaveBeenCalledWith('mailto:support@minitrading.dev');

    await fireEvent.press(screen.getByRole('button', { name: 'Browse as guest' }));
    expect(auth.session.getState().status).toBe('guest');
    expect(router.replace).toHaveBeenCalledWith('/(tabs)');
  });

  it('still offers support without a reason on file', async () => {
    await renderScreen(<Suspended />, { auth: testAuth() });

    expect(screen.queryByText('Reason from our team')).not.toBeOnTheScreen();
  });
});
