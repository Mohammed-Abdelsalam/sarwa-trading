import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Linking } from 'react-native';

import { type AuthSessionResponse } from '@sarwa/contracts';

import { ForgotPasswordScreen } from '../../../src/features/auth/forgot-password-screen';
import { ResetPasswordScreen } from '../../../src/features/auth/reset-password-screen';
import { SignInScreen } from '../../../src/features/auth/sign-in-screen';
import { SignUpScreen } from '../../../src/features/auth/sign-up-screen';
import { useForgotPasswordScreen } from '../../../src/features/auth/use-forgot-password-screen';
import { useResetPasswordScreen } from '../../../src/features/auth/use-reset-password-screen';
import { useSignInScreen } from '../../../src/features/auth/use-sign-in-screen';
import { useSignUpScreen } from '../../../src/features/auth/use-sign-up-screen';
import { useVerifyEmailScreen } from '../../../src/features/auth/use-verify-email-screen';
import { VerifyEmailScreen } from '../../../src/features/auth/verify-email-screen';
import { useToast } from '../../../src/lib/toast';
import { customer, mockApi, problem, renderScreen, testAuth } from '../../render';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), canGoBack: () => true, push: jest.fn(), replace: jest.fn() },
}));

const session = (overrides: Partial<AuthSessionResponse> = {}): AuthSessionResponse => ({
  user: customer(),
  accessToken: 'access',
  refreshToken: 'refresh',
  accessExpiresAt: 0,
  ...overrides,
});

function SignIn() {
  return <SignInScreen view={useSignInScreen()} />;
}
function SignUp() {
  return <SignUpScreen view={useSignUpScreen()} />;
}
function Forgot() {
  return <ForgotPasswordScreen view={useForgotPasswordScreen()} />;
}
function Reset() {
  return <ResetPasswordScreen view={useResetPasswordScreen('t'.repeat(32))} />;
}
function Verify() {
  return <VerifyEmailScreen view={useVerifyEmailScreen('v'.repeat(32))} />;
}

async function fillSignIn() {
  await fireEvent.changeText(screen.getByLabelText('Email'), 'Sara.H@example.com');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'practice-1234');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
}

async function fillSignUp() {
  await fireEvent.changeText(screen.getByLabelText('Name'), 'Sara Hassan');
  await fireEvent.changeText(screen.getByLabelText('Email'), 'sara.h@example.com');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'Tr4ding!sFun');
}

async function submitSignUp() {
  await fillSignUp();
  await fireEvent.press(screen.getByRole('checkbox'));
  await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
}

beforeEach(() => {
  jest.clearAllMocks();
  useToast.getState().hide();
});

describe('sign in', () => {
  it('signs in with this phone named, then returns to where the guest was', async () => {
    const auth = testAuth();
    const signIn = jest.fn(() => Promise.resolve(session()));
    await renderScreen(<SignIn />, { api: mockApi({ signIn }), auth });
    await fillSignIn();

    expect(signIn).toHaveBeenCalledWith({
      email: 'sara.h@example.com',
      password: 'practice-1234',
      keepSignedIn: true,
      deviceModel: 'iPhone 15',
    });
    expect(auth.session.getState().status).toBe('authenticated');
    expect(auth.transport.save).toHaveBeenCalled();
    expect(router.back).toHaveBeenCalled();
  });

  it('checks the email before sending anything', async () => {
    const signIn = jest.fn();
    await renderScreen(<SignIn />, { api: mockApi({ signIn }), auth: testAuth() });
    await fireEvent.changeText(screen.getByLabelText('Email'), 'sara');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

    expect(screen.getByText('Enter a full email address, e.g. name@example.com')).toBeOnTheScreen();
    expect(signIn).not.toHaveBeenCalled();
  });

  it('shows wrong credentials as a banner with the reset hint', async () => {
    const signIn = () => Promise.reject(problem('INVALID_CREDENTIALS', 401));
    await renderScreen(<SignIn />, { api: mockApi({ signIn }), auth: testAuth() });
    await fillSignIn();

    expect(screen.getByRole('alert')).toHaveTextContent(/Email or password is incorrect\./);
    expect(
      screen.getByText(/Check both and try again, or reset your password\./),
    ).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Password'), 'practice-12345');
    expect(screen.queryByRole('alert')).not.toBeOnTheScreen();
  });

  it('locks the button with a countdown when rate limited', async () => {
    const signIn = () => Promise.reject(problem('RATE_LIMITED', 429, { retryAfterSeconds: 42 }));
    await renderScreen(<SignIn />, { api: mockApi({ signIn }), auth: testAuth() });
    await fillSignIn();

    expect(screen.getByRole('button', { name: /Try again in 0:4\d/ })).toBeDisabled();
    expect(screen.getByText(/Too many attempts — try again in 0:4\d\./)).toBeOnTheScreen();
  });

  it('says so when the phone is offline', async () => {
    const signIn = () => Promise.reject(new TypeError('Network request failed'));
    await renderScreen(<SignIn />, { api: mockApi({ signIn }), auth: testAuth() });
    await fillSignIn();

    expect(screen.getByText('You’re offline. Reconnect to continue.')).toBeOnTheScreen();
  });

  it('asks before replacing this phone’s guest data, then resends with the ticket', async () => {
    const signIn = jest
      .fn()
      .mockRejectedValueOnce(
        problem('GUEST_DATA_PRESENT', 409, {
          ticket: 'ticket-1',
          positions: 3,
          openOrders: 1,
          watchlist: 7,
        }),
      )
      .mockResolvedValueOnce(session());
    await renderScreen(<SignIn />, { api: mockApi({ signIn }), auth: testAuth() });
    await fillSignIn();

    expect(screen.getByText('Replace this phone’s practice data?')).toBeOnTheScreen();
    expect(screen.getByText(/3 positions, 1 open order and a 7-stock watchlist/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in anyway' }));

    expect(signIn).toHaveBeenLastCalledWith(expect.objectContaining({ guestTicket: 'ticket-1' }));
  });

  it('moves a suspended account to the suspended state', async () => {
    const auth = testAuth();
    const suspension = {
      reasonCategory: 'abuse',
      reason: 'Automated trading scripts',
      at: 0,
      accountHandle: 'ACC-7F2A9C',
    };
    const signIn = () => Promise.reject(problem('ACCOUNT_SUSPENDED', 403, { suspension }));
    await renderScreen(<SignIn />, { api: mockApi({ signIn }), auth });
    await fillSignIn();

    await waitFor(() => {
      expect(auth.session.getState().status).toBe('suspended');
    });
  });

  it('tells a returning user their deletion was canceled', async () => {
    const signIn = () => Promise.resolve(session({ deletionCanceled: true }));
    await renderScreen(<SignIn />, { api: mockApi({ signIn }), auth: testAuth() });
    await fillSignIn();

    expect(useToast.getState().message).toBe(
      'Welcome back — your account is no longer being deleted',
    );
  });

  it('switches to sign-up and forgot password', async () => {
    await renderScreen(<SignIn />, { auth: testAuth() });
    await fireEvent.press(screen.getByRole('link', { name: 'Sign up' }));
    await fireEvent.press(screen.getByRole('link', { name: 'Forgot?' }));

    expect(router.replace).toHaveBeenCalledWith('/sign-up');
    expect(router.push).toHaveBeenCalledWith('/forgot-password');
  });
});

describe('sign up', () => {
  it('needs the terms ticked before it sends', async () => {
    const signUp = jest.fn();
    await renderScreen(<SignUp />, { api: mockApi({ signUp }), auth: testAuth() });
    await fillSignUp();
    await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));

    expect(screen.getByText('Accept the terms to continue')).toBeOnTheScreen();
    expect(signUp).not.toHaveBeenCalled();
    expect(screen.getByRole('progressbar', { name: 'Strength: Strong' })).toBeOnTheScreen();
    expect(screen.getByLabelText('At least 8 characters, Requirement met')).toBeOnTheScreen();
  });

  it('creates the account and confirms the guest portfolio was kept', async () => {
    const auth = testAuth();
    const signUp = jest.fn(() =>
      Promise.resolve(session({ claimed: { positions: 3, openOrders: 1, watchlist: 0 } })),
    );
    await renderScreen(<SignUp />, { api: mockApi({ signUp }), auth });
    await submitSignUp();

    expect(signUp).toHaveBeenCalledWith(
      expect.objectContaining({ terms: true, keepSignedIn: true, deviceModel: 'iPhone 15' }),
    );
    expect(auth.session.getState().status).toBe('authenticated');
    expect(useToast.getState().message).toBe('Your practice portfolio was saved to your account');
    expect(router.back).toHaveBeenCalled();
  });

  it('welcomes a new user by name when there was nothing to keep', async () => {
    const signUp = () => Promise.resolve(session());
    await renderScreen(<SignUp />, { api: mockApi({ signUp }), auth: testAuth() });
    await submitSignUp();

    expect(useToast.getState().message).toBe('Welcome, Sara Hassan — place your first trade.');
  });

  it('shows the server’s field errors under the field', async () => {
    const signUp = () =>
      Promise.reject(
        problem('VALIDATION_FAILED', 400, { errors: { password: ['PASSWORD_COMMON'] } }),
      );
    await renderScreen(<SignUp />, { api: mockApi({ signUp }), auth: testAuth() });
    await submitSignUp();

    expect(screen.getByText('This password is too common — try a longer phrase')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('link', { name: 'Sign in' }));
    expect(router.replace).toHaveBeenCalledWith('/sign-in');
  });

  it('says when the email already has an account', async () => {
    const signUp = () => Promise.reject(problem('EMAIL_IN_USE', 409));
    await renderScreen(<SignUp />, { api: mockApi({ signUp }), auth: testAuth() });
    await submitSignUp();

    expect(screen.getByRole('alert')).toHaveTextContent(/already exists/);
  });
});

describe('forgot password', () => {
  it('sends the link and waits a minute before resending', async () => {
    const forgotPassword = jest.fn(() => Promise.resolve());
    await renderScreen(<Forgot />, { api: mockApi({ forgotPassword }), auth: testAuth() });
    await fireEvent.changeText(screen.getByLabelText('Email'), 'sara.h@example.com');
    await fireEvent.press(screen.getByRole('button', { name: 'Send reset link' }));

    expect(forgotPassword).toHaveBeenCalledWith({ email: 'sara.h@example.com' });
    expect(screen.getByText(/It expires in 30 minutes\./)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /Resend in \d:\d\d/ })).toBeDisabled();

    const openURL = jest
      .spyOn(Linking, 'openURL')
      .mockRejectedValueOnce(new Error('no Mail'))
      .mockResolvedValueOnce(undefined);
    await fireEvent.press(screen.getByRole('button', { name: 'Open Mail' }));
    await waitFor(() => {
      expect(openURL).toHaveBeenLastCalledWith('mailto:');
    });
    expect(openURL).toHaveBeenCalledWith('message:');
  });

  it('shows the rate limit on the button', async () => {
    const forgotPassword = () =>
      Promise.reject(problem('RATE_LIMITED', 429, { retryAfterSeconds: 600 }));
    await renderScreen(<Forgot />, { api: mockApi({ forgotPassword }), auth: testAuth() });
    await fireEvent.changeText(screen.getByLabelText('Email'), 'sara.h@example.com');
    await fireEvent.press(screen.getByRole('button', { name: 'Send reset link' }));

    expect(screen.getByRole('button', { name: /Try again in \d+:\d\d/ })).toBeDisabled();
  });
});

describe('reset password', () => {
  it('checks the link, then saves the new password', async () => {
    const auth = testAuth();
    const resetPassword = jest.fn(() => Promise.resolve(session({ sessionsRevoked: 2 })));
    await renderScreen(<Reset />, {
      api: mockApi({
        getResetInfo: () => Promise.resolve({ email: 'sara.h@example.com' }),
        resetPassword,
      }),
      auth,
    });

    expect(await screen.findByText('For sara.h@example.com')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('New password'), 'Tr4ding!sFun');
    await fireEvent.changeText(screen.getByLabelText('Confirm password'), 'Tr4ding!sFn');
    await fireEvent.press(screen.getByRole('button', { name: 'Save new password' }));
    expect(screen.getByText("Passwords don't match")).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Confirm password'), 'Tr4ding!sFun');
    expect(screen.getByText('Passwords match ✓')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Save new password' }));

    expect(resetPassword).toHaveBeenCalledWith(
      expect.objectContaining({
        password: 'Tr4ding!sFun',
        keepSignedIn: true,
        deviceModel: 'iPhone 15',
      }),
    );
    expect(auth.session.getState().status).toBe('authenticated');
    await fireEvent.press(screen.getByRole('button', { name: 'Continue to Home' }));
    expect(router.replace).toHaveBeenCalledWith('/(tabs)');
  });

  it('offers a new link when this one expired', async () => {
    await renderScreen(<Reset />, {
      api: mockApi({ getResetInfo: () => Promise.reject(problem('TOKEN_EXPIRED', 410)) }),
      auth: testAuth(),
    });

    expect(await screen.findByText('This reset link has expired')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Request a new link' }));
    expect(router.replace).toHaveBeenCalledWith('/forgot-password');
  });

  it('shows progress while the link is checked', async () => {
    await renderScreen(<Reset />, { auth: testAuth() });

    expect(screen.getByRole('button', { name: 'Close' })).toBeOnTheScreen();
    expect(screen.queryByLabelText('New password')).not.toBeOnTheScreen();
  });
});

describe('verify email', () => {
  it('confirms the address and marks the signed-in user verified', async () => {
    const auth = testAuth('authenticated', customer({ emailVerified: false }));
    await renderScreen(<Verify />, {
      api: mockApi({ verifyEmail: () => Promise.resolve({ email: 'sara.h@example.com' }) }),
      auth,
    });

    expect(await screen.findByText('Email verified ✓')).toBeOnTheScreen();
    expect(auth.session.getState().user?.emailVerified).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Continue trading' }));
    expect(router.replace).toHaveBeenCalledWith('/(tabs)');
  });

  it('resends from an expired link to the address it named', async () => {
    const resendVerification = jest.fn(() => Promise.resolve());
    await renderScreen(<Verify />, {
      api: mockApi({
        verifyEmail: () =>
          Promise.reject(problem('TOKEN_EXPIRED', 410, { email: 'sara.h@example.com' })),
        resendVerification,
      }),
      auth: testAuth(),
    });

    expect(await screen.findByText(/work for 24 hours and only once/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Resend verification email' }));
    expect(resendVerification).toHaveBeenCalledWith({ email: 'sara.h@example.com' });
    expect(screen.getByText('We sent a new link to sara.h@example.com.')).toBeOnTheScreen();
  });

  it('asks a guest to sign in when the expired link names no one', async () => {
    await renderScreen(<Verify />, {
      api: mockApi({ verifyEmail: () => Promise.reject(problem('TOKEN_EXPIRED', 410)) }),
      auth: testAuth(),
    });

    expect(await screen.findByText(/Sign in to send a fresh one/)).toBeOnTheScreen();
  });

  it('shows a failure that is not an expiry', async () => {
    await renderScreen(<Verify />, {
      api: mockApi({ verifyEmail: () => Promise.reject(problem('INTERNAL', 500)) }),
      auth: testAuth(),
    });

    expect(
      await screen.findByText('Something went wrong. Nothing was changed — try again.'),
    ).toBeOnTheScreen();
  });

  it('shows progress while the link is checked', async () => {
    await renderScreen(<Verify />, { auth: testAuth() });

    expect(screen.getByText('Verifying your email…')).toBeOnTheScreen();
  });
});
