import { fireEvent, screen } from '@testing-library/react-native';

import { type FieldModel, type StrengthModel } from '../../../src/features/auth/auth-parts';
import {
  ForgotPasswordScreen,
  type ForgotPasswordView,
} from '../../../src/features/auth/forgot-password-screen';
import {
  ResetPasswordScreen,
  type ResetPasswordView,
} from '../../../src/features/auth/reset-password-screen';
import { SignInScreen, type SignInView } from '../../../src/features/auth/sign-in-screen';
import { SignUpScreen, type SignUpView } from '../../../src/features/auth/sign-up-screen';
import { renderScreen } from '../../render';

jest.mock('expo-router', () => ({ router: { back: jest.fn(), canGoBack: () => true } }));

const field = (value = '', error?: string): FieldModel => ({ value, onChange: jest.fn(), error });
const submit = (overrides = {}) => ({ onSubmit: jest.fn(), loading: false, ...overrides });
const good: StrengthModel = { level: 3, minLength: true, notCommon: true, tip: false };

function signUpView(overrides: Partial<SignUpView> = {}): SignUpView {
  return {
    startingCash: '$100,000',
    name: field('Sara Hassan'),
    email: field('sara.h@example.com'),
    password: field('Tr4ding!sFun'),
    strength: good,
    terms: { checked: false, onChange: jest.fn() },
    submit: submit(),
    onSignIn: jest.fn(),
    onClose: jest.fn(),
    ...overrides,
  };
}

function signInView(overrides: Partial<SignInView> = {}): SignInView {
  return {
    email: field('sara.h@example.com'),
    password: field('hunter2hunter2'),
    submit: submit(),
    onForgot: jest.fn(),
    onSignUp: jest.fn(),
    onClose: jest.fn(),
    ...overrides,
  };
}

describe('SignUpScreen', () => {
  it('shows the value line, strength and the terms checkbox', async () => {
    const view = signUpView();
    await renderScreen(<SignUpScreen view={view} />);

    expect(screen.getByText('Create your account')).toBeOnTheScreen();
    expect(
      screen.getByText('Practice trading US stocks with $100,000 virtual cash'),
    ).toBeOnTheScreen();
    expect(screen.getByRole('progressbar', { name: 'Strength: Good' })).toBeOnTheScreen();
    expect(screen.getByText('At least 8 characters')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('checkbox'));
    expect(view.terms.onChange).toHaveBeenCalledWith(true);

    await fireEvent.changeText(screen.getByLabelText('Name'), 'Sara');
    expect(view.name.onChange).toHaveBeenCalledWith('Sara');

    await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
    expect(view.submit.onSubmit).toHaveBeenCalled();
  });

  it('marks invalid fields and keeps Google and Apple announced as coming soon', async () => {
    await renderScreen(
      <SignUpScreen
        view={signUpView({
          email: field('sara', 'Enter a full email address, e.g. name@example.com'),
          terms: { checked: false, onChange: jest.fn(), error: 'Accept the terms to continue' },
        })}
      />,
    );

    expect(screen.getByText('Enter a full email address, e.g. name@example.com')).toBeOnTheScreen();
    expect(screen.getByText('Accept the terms to continue')).toBeOnTheScreen();
    expect(
      screen.getByRole('button', { name: 'Continue with Google — coming soon' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Continue with Apple — coming soon' }),
    ).toBeDisabled();
  });

  it('toggles the password between hidden and shown', async () => {
    await renderScreen(<SignUpScreen view={signUpView()} />);

    expect(screen.getByLabelText('Password')).toHaveProp('secureTextEntry', true);
    await fireEvent.press(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByLabelText('Password')).toHaveProp('secureTextEntry', false);
    expect(screen.getByRole('button', { name: 'Hide password' })).toBeOnTheScreen();
  });
});

describe('SignInScreen', () => {
  it('shows the invalid-credentials banner and links to forgot password', async () => {
    const view = signInView({
      notice: { kind: 'error', message: 'Email or password is incorrect.' },
    });
    await renderScreen(<SignInScreen view={view} />);

    expect(screen.getByRole('alert')).toHaveTextContent(/Email or password is incorrect\./);
    await fireEvent.press(screen.getByRole('link', { name: 'Forgot?' }));
    expect(view.onForgot).toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('link', { name: 'Sign up' }));
    expect(view.onSignUp).toHaveBeenCalled();
  });

  it('disables the button with a countdown while rate-limited, inputs stay editable', async () => {
    const view = signInView({
      notice: { kind: 'rateLimited', message: 'Too many attempts — try again in 0:42.' },
      submit: submit({ retryIn: '0:42' }),
    });
    await renderScreen(<SignInScreen view={view} />);

    expect(screen.getByRole('button', { name: 'Try again in 0:42' })).toBeDisabled();
    expect(screen.getByLabelText('Email')).toHaveProp('editable', true);
  });

  it('reads "Signing in…" while the request runs', async () => {
    await renderScreen(<SignInScreen view={signInView({ submit: submit({ loading: true }) })} />);

    expect(screen.getByRole('button', { name: 'Signing in…' })).toBeDisabled();
  });

  it('asks before replacing this phone’s guest data', async () => {
    const guestData = {
      positions: '3 positions',
      orders: '1 open order',
      watchlist: 'a 7-stock watchlist',
      onConfirm: jest.fn(),
      onCancel: jest.fn(),
      confirming: false,
    };
    await renderScreen(<SignInScreen view={signInView({ guestData })} />);

    expect(screen.getByText('Replace this phone’s practice data?')).toBeOnTheScreen();
    expect(screen.getByText(/On this phone: 3 positions, 1 open order/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in anyway' }));
    expect(guestData.onConfirm).toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(guestData.onCancel).toHaveBeenCalled();
  });

  it('renders in Arabic', async () => {
    await renderScreen(<SignInScreen view={signInView()} />, { locale: 'ar' });

    expect(screen.getByText('مرحبًا بعودتك')).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'نسيتها؟' })).toBeOnTheScreen();
  });
});

describe('ForgotPasswordScreen', () => {
  const base: ForgotPasswordView = {
    email: field('sara.h@example.com'),
    submit: submit(),
    onBack: jest.fn(),
  };

  it('sends the reset link', async () => {
    await renderScreen(<ForgotPasswordScreen view={base} />);

    expect(screen.getByText('Reset your password')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Send reset link' }));
    expect(base.submit.onSubmit).toHaveBeenCalled();
  });

  it('shows the neutral sent state with a resend countdown', async () => {
    const sent = {
      email: 'sara.h@example.com',
      expiresIn: '30 minutes',
      resendIn: '0:54',
      onResend: jest.fn(),
      onOpenMail: jest.fn(),
    };
    await renderScreen(<ForgotPasswordScreen view={{ ...base, sent }} />);

    expect(screen.getByText('Check your inbox')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'If an account exists for sara.h@example.com, we sent a reset link. It expires in 30 minutes.',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Resend in 0:54' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Open Mail' }));
    expect(sent.onOpenMail).toHaveBeenCalled();
  });
});

describe('ResetPasswordScreen', () => {
  it('confirms a matching new password and warns about other devices', async () => {
    const view: ResetPasswordView = {
      state: 'form',
      email: 'sara.h@example.com',
      password: field('Gr33n-candles-only'),
      confirm: field('Gr33n-candles-only'),
      strength: { level: 4, minLength: true, notCommon: true, tip: false },
      matches: true,
      submit: submit(),
      onClose: jest.fn(),
    };
    await renderScreen(<ResetPasswordScreen view={view} />);

    expect(screen.getByText('For sara.h@example.com')).toBeOnTheScreen();
    expect(screen.getByRole('progressbar', { name: 'Strength: Strong' })).toBeOnTheScreen();
    expect(screen.getByText('Passwords match ✓')).toBeOnTheScreen();
    expect(screen.getByText('Saving signs you out on every other device.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Save new password' }));
    expect(view.submit.onSubmit).toHaveBeenCalled();
  });

  it('confirms the update and continues home', async () => {
    const onContinue = jest.fn();
    await renderScreen(<ResetPasswordScreen view={{ state: 'done', onContinue }} />);

    expect(screen.getByText('Password updated')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Continue to Home' }));
    expect(onContinue).toHaveBeenCalled();
  });

  it('offers a fresh link when the token expired', async () => {
    const onRequestNew = jest.fn();
    await renderScreen(
      <ResetPasswordScreen
        view={{ state: 'expired', duration: '30 minutes', onRequestNew, onClose: jest.fn() }}
      />,
    );

    expect(screen.getByText('This reset link has expired')).toBeOnTheScreen();
    expect(screen.getByText(/Reset links work for 30 minutes/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Request a new link' }));
    expect(onRequestNew).toHaveBeenCalled();
  });
});
