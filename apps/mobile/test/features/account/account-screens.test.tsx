import { fireEvent, screen } from '@testing-library/react-native';

import {
  ChangePasswordScreen,
  type ChangePasswordView,
} from '../../../src/features/account/change-password-screen';
import {
  DeleteAccountScreen,
  type DeleteAccountView,
  ResetAccountScreen,
} from '../../../src/features/account/danger-screens';
import {
  type SecurityView,
  SecurityScreen,
  type SessionRowModel,
} from '../../../src/features/account/security-screen';
import { SignedOutSheet, SuspendedScreen } from '../../../src/features/account/session-ended';
import {
  SignedInAccountScreen,
  type SignedInAccountView,
} from '../../../src/features/account/signed-in-account';
import { type FieldModel } from '../../../src/features/auth/auth-parts';
import { renderScreen } from '../../render';

jest.mock('expo-router', () => ({ router: { back: jest.fn(), canGoBack: () => true } }));

const field = (value = '', error?: string): FieldModel => ({ value, onChange: jest.fn(), error });
const submit = () => ({ onSubmit: jest.fn(), loading: false });

function accountView(overrides: Partial<SignedInAccountView> = {}): SignedInAccountView {
  return {
    name: 'Sara Hassan',
    email: 'sara.h@example.com',
    emailVerified: true,
    handle: 'ACC-7F2K9Q',
    devices: '3 devices',
    language: 'English',
    theme: 'Dark',
    onPersonalInfo: jest.fn(),
    onSecurity: jest.fn(),
    onNotifications: jest.fn(),
    onLanguage: jest.fn(),
    onAppearance: jest.fn(),
    onTrading: jest.fn(),
    onReset: jest.fn(),
    onSignOut: jest.fn(),
    onDelete: jest.fn(),
    ...overrides,
  };
}

const sessions: SessionRowModel[] = [
  {
    id: 's1',
    label: 'iPhone 15',
    platform: 'ios',
    meta: '41.32.•.• · Active now',
    current: true,
    signingOut: false,
  },
  {
    id: 's2',
    label: 'Chrome on macOS',
    platform: 'web',
    meta: '41.32.•.• · 2 min ago',
    current: false,
    signingOut: false,
  },
];

function securityView(overrides: Partial<SecurityView> = {}): SecurityView {
  return {
    passwordChanged: 'Last changed 34 days ago',
    sessions,
    sessionsError: false,
    devices: '2 devices',
    onChangePassword: jest.fn(),
    onSignOutSession: jest.fn(),
    onSignOutOthers: jest.fn(),
    onRetry: jest.fn(),
    onBack: jest.fn(),
    ...overrides,
  };
}

describe('SignedInAccountScreen', () => {
  it('shows the profile header and every row', async () => {
    const view = accountView();
    await renderScreen(<SignedInAccountScreen view={view} />);

    expect(screen.getByText('Sara Hassan')).toBeOnTheScreen();
    expect(screen.getByText('Verified')).toBeOnTheScreen();
    expect(screen.getByText('ACC-7F2K9Q')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Security, 3 devices' }));
    expect(view.onSecurity).toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Language, English' }));
    expect(view.onLanguage).toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Delete account' }));
    expect(view.onDelete).toHaveBeenCalled();
  });

  it('flags an unverified email and renders in Arabic', async () => {
    await renderScreen(<SignedInAccountScreen view={accountView({ emailVerified: false })} />, {
      locale: 'ar',
    });

    expect(screen.getByText('الأمان')).toBeOnTheScreen();
    expect(screen.queryByText('Verified')).not.toBeOnTheScreen();
  });
});

describe('SecurityScreen', () => {
  it('marks this device and signs out another one', async () => {
    const view = securityView();
    await renderScreen(<SecurityScreen view={view} />);

    expect(screen.getByText('This device')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Sign out Chrome on macOS' }));
    expect(view.onSignOutSession).toHaveBeenCalledWith('s2');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign out of all other devices' }));
    expect(view.onSignOutOthers).toHaveBeenCalled();
  });

  it('confirms signing out the other devices in a sheet', async () => {
    const confirm = {
      sessions: '1 session',
      devices: 'Chrome on macOS',
      deviceCount: '1 device',
      confirming: false,
      onConfirm: jest.fn(),
      onCancel: jest.fn(),
    };
    await renderScreen(<SecurityScreen view={securityView({ confirmSignOutOthers: confirm })} />);

    expect(screen.getByText('Sign out of all other devices?')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Sign out 1 device' }));
    expect(confirm.onConfirm).toHaveBeenCalled();
  });

  it('retries a failed sessions load without offering sign-out', async () => {
    const view = securityView({ sessions: null, sessionsError: true });
    await renderScreen(<SecurityScreen view={view} />);

    expect(screen.getByText("Couldn't load your sessions")).toBeOnTheScreen();
    expect(
      screen.queryByRole('button', { name: 'Sign out of all other devices' }),
    ).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    expect(view.onRetry).toHaveBeenCalled();
  });
});

describe('ChangePasswordScreen', () => {
  it('shows the wrong-current-password error and the sign-out warning', async () => {
    const view: ChangePasswordView = {
      current: field('nope', 'Current password is incorrect.'),
      password: field('Gr33n-candles-only'),
      confirm: field('Gr33n-candles-only'),
      strength: { level: 4, minLength: true, notCommon: true, tip: false },
      matches: true,
      submit: submit(),
      onBack: jest.fn(),
    };
    await renderScreen(<ChangePasswordScreen view={view} />);

    expect(screen.getByText('Current password is incorrect.')).toBeOnTheScreen();
    expect(screen.getByText('Other devices will be signed out.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Update password' }));
    expect(view.submit.onSubmit).toHaveBeenCalled();
  });
});

describe('danger screens', () => {
  it('asks for the password and the typed DELETE', async () => {
    const view: DeleteAccountView = {
      grace: '7 days',
      consequences: 'Your practice portfolio ($110,194.29) will be deleted.',
      password: field(),
      confirm: { ...field('DELETE'), word: 'DELETE' },
      submit: submit(),
      onCancel: jest.fn(),
    };
    await renderScreen(<DeleteAccountScreen view={view} />);

    expect(screen.getByText(/This can’t be undone after 7 days\./)).toBeOnTheScreen();
    expect(screen.getByLabelText('Type DELETE to confirm')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Delete my account' }));
    expect(view.submit.onSubmit).toHaveBeenCalled();
  });

  it('compares equity before and after a practice reset', async () => {
    await renderScreen(
      <ResetAccountScreen
        view={{
          consequences: 'Closes 3 positions at last price.',
          equityNow: '$110,194.29',
          equityAfter: '$100,000.00',
          confirm: { ...field(), word: 'RESET' },
          submit: submit(),
          onCancel: jest.fn(),
        }}
      />,
    );

    expect(screen.getByLabelText('Equity now: $110,194.29')).toBeOnTheScreen();
    expect(screen.getByLabelText('Type RESET to confirm')).toBeOnTheScreen();
  });
});

describe('session ended', () => {
  it('shows the suspension reason and lets the user browse as a guest', async () => {
    const view = {
      reason: {
        category: 'Automated trading scripts',
        text: 'Automated scripts placing orders.',
        date: 'Nov 27, 2026',
      },
      handle: 'ACC-7F2K9Q',
      supportEmail: 'support@minitrading.dev',
      onContactSupport: jest.fn(),
      onBrowseAsGuest: jest.fn(),
    };
    await renderScreen(<SuspendedScreen view={view} />);

    expect(screen.getByText('Your account is suspended')).toBeOnTheScreen();
    expect(
      screen.getByText('“Automated scripts placing orders.” · Nov 27, 2026'),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Browse as guest' }));
    expect(view.onBrowseAsGuest).toHaveBeenCalled();
  });

  it('explains a password change and offers a reset', async () => {
    const view = {
      reason: 'password_changed' as const,
      onSignIn: jest.fn(),
      onResetPassword: jest.fn(),
      onClose: jest.fn(),
    };
    await renderScreen(<SignedOutSheet view={view} />);

    expect(screen.getByText('You were signed out')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Reset password' }));
    expect(view.onResetPassword).toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in again' }));
    expect(view.onSignIn).toHaveBeenCalled();
  });

  it('offers only sign-in for an expired session', async () => {
    await renderScreen(
      <SignedOutSheet
        view={{
          reason: 'expired',
          onSignIn: jest.fn(),
          onResetPassword: jest.fn(),
          onClose: jest.fn(),
        }}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Reset password' })).not.toBeOnTheScreen();
  });
});
