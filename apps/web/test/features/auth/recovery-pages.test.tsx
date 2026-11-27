import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ForgotPasswordPage } from '../../../src/features/auth/forgot-password-page';
import { ResetPasswordPage } from '../../../src/features/auth/reset-password-page';
import { VerifyEmailPage } from '../../../src/features/auth/verify-email-page';
import { providers } from '../../copy';
import { forgotView, resetView, verifyView } from './auth-fixtures';

const wrapper = providers().wrapper;

describe('ForgotPasswordPage', () => {
  it('asks for the email and sends the link', async () => {
    const view = forgotView({ email: '' });
    render(<ForgotPasswordPage view={view} />, { wrapper });
    expect(screen.getByRole('heading', { level: 1, name: 'Reset your password' })).toBeVisible();
    await userEvent.type(screen.getByLabelText('Email'), 's');
    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
    expect(view.actions.setEmail).toHaveBeenCalledWith('s');
    expect(view.actions.submit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute(
      'href',
      '/signin',
    );
  });

  it('shows the same neutral sent state with a resend countdown', () => {
    render(<ForgotPasswordPage view={forgotView({ step: 'sent', resendIn: '0:54' })} />, {
      wrapper,
    });
    expect(screen.getByRole('heading', { level: 1, name: 'Check your inbox' })).toBeVisible();
    expect(
      screen.getByText(
        'If an account exists for sara.h@example.com, we sent a link to reset your password. It expires in 30 minutes.',
      ),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Open email app' })).toHaveAttribute('href', 'mailto:');
    expect(screen.getByText('Didn’t get it? Check spam or resend in 0:54')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Resend link' })).not.toBeInTheDocument();
  });

  it('resends once the cooldown is over', async () => {
    const view = forgotView({ step: 'sent' });
    render(<ForgotPasswordPage view={view} />, { wrapper });
    await userEvent.click(screen.getByRole('button', { name: 'Resend link' }));
    expect(view.actions.resend).toHaveBeenCalledTimes(1);
  });
});

describe('ResetPasswordPage', () => {
  it('confirms the match and warns about other devices', async () => {
    const view = resetView();
    render(<ResetPasswordPage view={view} />, { wrapper });
    expect(screen.getByText('For sara.h@example.com')).toBeVisible();
    expect(screen.getByRole('meter', { name: 'Strength' })).toHaveAttribute(
      'aria-valuetext',
      'Strong',
    );
    expect(screen.getByLabelText('Confirm new password')).toHaveAccessibleDescription(
      'Passwords match ✓',
    );
    expect(screen.getByText('Saving signs you out on every other device.')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Save new password' }));
    expect(view.actions.submit).toHaveBeenCalledTimes(1);
  });

  it('flags a mismatched confirmation', () => {
    render(
      <ResetPasswordPage
        view={resetView({ matches: false, errors: { confirm: { code: 'PASSWORDS_DIFFER' } } })}
      />,
      { wrapper },
    );
    expect(screen.getByLabelText('Confirm new password')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText("Passwords don't match")).toBeVisible();
  });

  it('reports how many sessions ended', () => {
    render(<ResetPasswordPage view={resetView({ status: 'done', sessionsRevoked: 2 })} />, {
      wrapper,
    });
    expect(screen.getByRole('heading', { level: 1, name: 'Password updated' })).toBeVisible();
    expect(
      screen.getByText('You’re signed in. Other devices were signed out — 2 sessions ended.'),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Go to Home' })).toHaveAttribute('href', '/');
  });

  it('sends an expired link back to forgot password', () => {
    render(<ResetPasswordPage view={resetView({ status: 'expired' })} />, { wrapper });
    expect(
      screen.getByRole('heading', { level: 1, name: 'This reset link has expired' }),
    ).toBeVisible();
    expect(
      screen.getByText(
        'Reset links work for 30 minutes and only once. Request a new one to choose your password.',
      ),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Request a new link' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });

  it('shows progress while the link is checked', () => {
    render(<ResetPasswordPage view={resetView({ status: 'checking' })} />, { wrapper });
    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
  });
});

describe('VerifyEmailPage', () => {
  it('confirms the address', () => {
    render(<VerifyEmailPage view={verifyView()} />, { wrapper });
    expect(screen.getByRole('heading', { level: 1, name: 'Email verified ✓' })).toBeVisible();
    expect(
      screen.getByText('sara.h@example.com is confirmed. Your account is secured.'),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Continue trading' })).toHaveAttribute('href', '/');
  });

  it('resends an expired link and says where it went', async () => {
    const view = verifyView({ status: 'expired' });
    const { rerender } = render(<VerifyEmailPage view={view} />, { wrapper });
    expect(
      screen.getByText(
        'Verification links work for 24 hours and only once. Send a fresh one to sara.h@example.com.',
      ),
    ).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Resend verification email' }));
    expect(view.actions.resend).toHaveBeenCalledTimes(1);

    rerender(<VerifyEmailPage view={{ ...view, resend: 'sent' }} />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'We sent a new link to sara.h@example.com.',
    );
    expect(screen.getByRole('button', { name: 'Resend verification email' })).toBeDisabled();
  });

  it('asks to sign in when the expired link names no address', () => {
    render(<VerifyEmailPage view={verifyView({ status: 'expired', email: null })} />, {
      wrapper,
    });
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/signin');
  });

  it('shows progress while verifying', () => {
    render(<VerifyEmailPage view={verifyView({ status: 'checking' })} />, { wrapper });
    expect(screen.getByRole('status')).toHaveTextContent('Verifying your email…');
  });
});
