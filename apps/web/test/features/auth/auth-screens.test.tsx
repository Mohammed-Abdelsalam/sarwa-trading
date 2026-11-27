import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode } from 'react';

import { type ApiClient } from '@sarwa/core';

import { ToastHost } from '../../../src/components/layout/toast-host';
import { ForgotPasswordScreen } from '../../../src/features/auth/forgot-password-page';
import { ResetPasswordScreen } from '../../../src/features/auth/reset-password-page';
import { SignInScreen } from '../../../src/features/auth/sign-in-page';
import { SignUpScreen } from '../../../src/features/auth/sign-up-page';
import { VerifyEmailScreen } from '../../../src/features/auth/verify-email-page';
import { providers } from '../../copy';
import { apiProblem, makeUser, sessionResponse, testAuth } from '../../fixtures';

const router = { push: jest.fn(), replace: jest.fn() };
let search = '';
jest.mock('next/navigation', () => ({
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(search),
}));

beforeEach(() => {
  router.push.mockClear();
  router.replace.mockClear();
  search = '';
  window.history.replaceState(null, '', '/');
});

function setup(api: Partial<ApiClient> = {}) {
  const auth = testAuth();
  const base = providers({ api, auth });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <base.wrapper>
      <ToastHost>{children}</ToastHost>
    </base.wrapper>
  );
  return { auth, wrapper };
}

async function fillSignIn() {
  await userEvent.type(screen.getByLabelText('Email'), 'sara.h@example.com');
  await userEvent.type(screen.getByLabelText('Password'), 'practice-1234');
}

describe('sign in, wired', () => {
  it('signs in, keeps the 30-day choice and lands on Home', async () => {
    const signIn = jest.fn().mockResolvedValue(sessionResponse());
    const { auth, wrapper } = setup({ signIn });
    render(<SignInScreen />, { wrapper });
    await fillSignIn();
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('/');
    });
    expect(signIn).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'sara.h@example.com',
        password: 'practice-1234',
        keepSignedIn: true,
      }),
    );
    expect(auth.session.getState().status).toBe('authenticated');
  });

  it('says a canceled deletion out loud', async () => {
    const signIn = jest.fn().mockResolvedValue(sessionResponse({ deletionCanceled: true }));
    const { wrapper } = setup({ signIn });
    render(<SignInScreen />, { wrapper });
    await fillSignIn();
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(
      await screen.findByText('Welcome back — your account is no longer being deleted'),
    ).toBeVisible();
  });

  it('shows the wrong-credentials banner and checks fields before sending', async () => {
    const signIn = jest.fn().mockRejectedValue(apiProblem(401, 'INVALID_CREDENTIALS'));
    const { auth, wrapper } = setup({ signIn });
    render(<SignInScreen />, { wrapper });
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(signIn).not.toHaveBeenCalled();
    expect(screen.getByText('Enter a full email address, e.g. name@example.com')).toBeVisible();

    await fillSignIn();
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.');
    expect(auth.session.getState().status).toBe('guest');
  });

  it('counts a rate limit down on the button', async () => {
    const signIn = jest
      .fn()
      .mockRejectedValue(apiProblem(429, 'RATE_LIMITED', { retryAfterSeconds: 42 }));
    const { wrapper } = setup({ signIn });
    render(<SignInScreen />, { wrapper });
    await fillSignIn();
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('button', { name: /^Try again in 0:4\d$/ })).toBeDisabled();
  });

  it('asks before replacing this device’s guest data, then sends the ticket', async () => {
    const signIn = jest
      .fn()
      .mockRejectedValueOnce(
        apiProblem(409, 'GUEST_DATA_PRESENT', {
          ticket: 'ticket-1',
          positions: 3,
          openOrders: 1,
          watchlist: 7,
        }),
      )
      .mockResolvedValueOnce(sessionResponse());
    const { wrapper } = setup({ signIn });
    render(<SignInScreen />, { wrapper });
    await fillSignIn();
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    const dialog = await screen.findByRole('dialog', {
      name: 'Signing in will replace this device’s practice data',
    });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Sign in anyway' }));
    await waitFor(() => {
      expect(signIn).toHaveBeenLastCalledWith(expect.objectContaining({ guestTicket: 'ticket-1' }));
    });
  });

  it('keeps the guest state when the replace warning is canceled', async () => {
    const signIn = jest.fn().mockRejectedValue(
      apiProblem(409, 'GUEST_DATA_PRESENT', {
        ticket: 'ticket-1',
        positions: 1,
        openOrders: 0,
        watchlist: 0,
      }),
    );
    const { auth, wrapper } = setup({ signIn });
    render(<SignInScreen />, { wrapper });
    await fillSignIn();
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(signIn).toHaveBeenCalledTimes(1);
    expect(auth.session.getState().status).toBe('guest');
  });

  it('moves a suspended account to the suspended state with its details', async () => {
    const suspension = {
      reasonCategory: 'abuse',
      reason: 'Automated order spam',
      at: 1,
      accountHandle: 'ACC-7F2E9A',
    };
    const signIn = jest
      .fn()
      .mockRejectedValue(apiProblem(403, 'ACCOUNT_SUSPENDED', { suspension }));
    const { auth, wrapper } = setup({ signIn });
    render(<SignInScreen />, { wrapper });
    await fillSignIn();
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(auth.session.getState().status).toBe('suspended');
    });
    expect(auth.session.getState().suspension).toEqual(suspension);
  });
});

describe('sign up, wired', () => {
  async function fillSignUp(password = 'Tradingisfun') {
    await userEvent.type(screen.getByLabelText('Name'), 'Sara Hassan');
    await userEvent.type(screen.getByLabelText('Email'), 'sara.h@example.com');
    await userEvent.type(screen.getByLabelText('Password'), password);
  }

  it('needs the terms, then creates the account and greets on Home', async () => {
    const signUp = jest.fn().mockResolvedValue(sessionResponse());
    const { auth, wrapper } = setup({ signUp });
    render(<SignUpScreen />, { wrapper });
    await fillSignUp();
    expect(screen.getByRole('meter', { name: 'Strength' })).toHaveAttribute(
      'aria-valuetext',
      'Good',
    );
    expect(screen.getAllByText(', Requirement met', { exact: false })).toHaveLength(2);
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByText('Accept the terms to continue')).toBeVisible();
    expect(signUp).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('checkbox', { name: /I agree to the Terms/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(
      await screen.findByText('Welcome, Sara Hassan. Prices are live and simulated.'),
    ).toBeVisible();
    expect(router.replace).toHaveBeenCalledWith('/');
    expect(signUp).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Sara Hassan', terms: true, keepSignedIn: true }),
    );
    expect(auth.session.getState().user?.name).toBe('Sara Hassan');
  });

  it('says the guest portfolio was kept when sign-up claimed it', async () => {
    const signUp = jest
      .fn()
      .mockResolvedValue(
        sessionResponse({ claimed: { positions: 3, openOrders: 1, watchlist: 7 } }),
      );
    const { wrapper } = setup({ signUp });
    render(<SignUpScreen />, { wrapper });
    await fillSignUp();
    await userEvent.click(screen.getByRole('checkbox', { name: /I agree to the Terms/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Your practice portfolio was saved')).toBeVisible();
  });

  it('shows the server’s field codes and an in-use email', async () => {
    const signUp = jest
      .fn()
      .mockRejectedValueOnce(
        apiProblem(400, 'VALIDATION_FAILED', { errors: { password: ['PASSWORD_COMMON'] } }),
      )
      .mockRejectedValueOnce(apiProblem(409, 'EMAIL_IN_USE'));
    const { wrapper } = setup({ signUp });
    render(<SignUpScreen />, { wrapper });
    await fillSignUp();
    await userEvent.click(screen.getByRole('checkbox', { name: /I agree to the Terms/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(
      await screen.findByText('This password is too common — try a longer phrase'),
    ).toBeVisible();

    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'An account with this email already exists. Sign in instead?',
    );
  });

  it('names the length limit on a short password', async () => {
    const { wrapper } = setup();
    render(<SignUpScreen />, { wrapper });
    await fillSignUp('short');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(screen.getByText('Use at least 8 characters')).toBeVisible();
  });
});

describe('recovery, wired', () => {
  it('sends a reset link, shows the neutral sent state and waits before resending', async () => {
    const forgotPassword = jest.fn().mockResolvedValue(undefined);
    const { wrapper } = setup({ forgotPassword });
    render(<ForgotPasswordScreen />, { wrapper });
    await userEvent.type(screen.getByLabelText('Email'), 'sara.h@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByRole('heading', { name: 'Check your inbox' })).toBeVisible();
    expect(forgotPassword).toHaveBeenCalledWith({ email: 'sara.h@example.com' });
    expect(await screen.findByText(/resend in 1:00|resend in 0:5\d/)).toBeVisible();
  });

  it('resets the password from the emailed link and signs in', async () => {
    search = 'token=reset-token-1234567890';
    window.history.replaceState(null, '', `/reset-password?${search}`);
    const getResetInfo = jest.fn().mockResolvedValue({ email: 'sara.h@example.com' });
    const resetPassword = jest.fn().mockResolvedValue(sessionResponse({ sessionsRevoked: 2 }));
    const { auth, wrapper } = setup({ getResetInfo, resetPassword });
    render(<ResetPasswordScreen />, { wrapper });

    expect(await screen.findByText('For sara.h@example.com')).toBeVisible();
    await userEvent.type(screen.getByLabelText('New password'), 'Tr4ding!sFun2026');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'Tr4ding!sFun2025');
    await userEvent.click(screen.getByRole('button', { name: 'Save new password' }));
    expect(screen.getByText("Passwords don't match")).toBeVisible();
    expect(resetPassword).not.toHaveBeenCalled();

    await userEvent.clear(screen.getByLabelText('Confirm new password'));
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'Tr4ding!sFun2026');
    await userEvent.click(screen.getByRole('button', { name: 'Save new password' }));
    expect(await screen.findByRole('heading', { name: 'Password updated' })).toBeVisible();
    expect(screen.getByText(/2 sessions ended/)).toBeVisible();
    expect(resetPassword).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'reset-token-1234567890', password: 'Tr4ding!sFun2026' }),
    );
    expect(auth.session.getState().status).toBe('authenticated');
  });

  it('offers a new link when the reset link has expired (410)', async () => {
    search = 'token=reset-token-1234567890';
    window.history.replaceState(null, '', `/reset-password?${search}`);
    const getResetInfo = jest.fn().mockRejectedValue(apiProblem(410, 'TOKEN_EXPIRED'));
    const { wrapper } = setup({ getResetInfo });
    render(<ResetPasswordScreen />, { wrapper });

    expect(
      await screen.findByRole('heading', { name: 'This reset link has expired' }),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Request a new link' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });

  it('verifies the email and marks the signed-in user verified', async () => {
    search = 'token=verify-token-1234567890';
    window.history.replaceState(null, '', `/verify-email?${search}`);
    const verifyEmail = jest.fn().mockResolvedValue({ email: 'sara.h@example.com' });
    const auth = testAuth({ user: makeUser({ emailVerified: false }) });
    render(<VerifyEmailScreen />, { wrapper: providers({ api: { verifyEmail }, auth }).wrapper });

    expect(await screen.findByRole('heading', { name: 'Email verified ✓' })).toBeVisible();
    expect(auth.session.getState().user?.emailVerified).toBe(true);
  });

  it('resends to the address an expired verify link names', async () => {
    search = 'token=verify-token-1234567890';
    window.history.replaceState(null, '', `/verify-email?${search}`);
    const verifyEmail = jest
      .fn()
      .mockRejectedValue(apiProblem(410, 'TOKEN_EXPIRED', { email: 'sara.h@example.com' }));
    const resendVerification = jest.fn().mockResolvedValue(undefined);
    const { wrapper } = setup({ verifyEmail, resendVerification });
    render(<VerifyEmailScreen />, { wrapper });
    await userEvent.click(await screen.findByRole('button', { name: 'Resend verification email' }));

    expect(await screen.findByText('We sent a new link to sara.h@example.com.')).toBeVisible();
    expect(resendVerification).toHaveBeenCalledWith({ email: 'sara.h@example.com' });
  });
});
