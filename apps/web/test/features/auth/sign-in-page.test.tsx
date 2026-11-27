import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SignInPage } from '../../../src/features/auth/sign-in-page';
import { providers } from '../../copy';
import { signInView } from './auth-fixtures';

function renderPage(view = signInView(), locale?: 'en' | 'ar') {
  const { wrapper } = providers({ locale });
  const utils = render(<SignInPage view={view} />, { wrapper });
  return {
    ...utils,
    update: (next: typeof view) => {
      utils.rerender(<SignInPage view={next} />);
    },
  };
}

describe('SignInPage', () => {
  it('signs in with the 30-day keep-me-signed-in box and links to reset and sign up', async () => {
    const view = signInView();
    renderPage(view);
    expect(screen.getByRole('heading', { level: 1, name: 'Welcome back' })).toBeVisible();
    expect(
      screen.getByRole('checkbox', { name: 'Keep me signed in on this device for 30 days' }),
    ).toBeChecked();
    expect(screen.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute(
      'href',
      '/signup',
    );
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(view.actions.setKeepSignedIn).toHaveBeenCalledWith(false);
    expect(view.actions.submit).toHaveBeenCalledTimes(1);
  });

  it('focuses the wrong-credentials banner and flags the password', () => {
    renderPage(signInView({ problem: 'INVALID_CREDENTIALS' }));
    const banner = screen.getByRole('alert');
    expect(banner).toHaveFocus();
    expect(banner).toHaveTextContent('Email or password is incorrect.');
    expect(banner).toHaveTextContent('Check both and try again, or reset your password.');
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
  });

  it('disables the form while signing in', () => {
    renderPage(signInView({ isPending: true }));
    const button = screen.getByRole('button', { name: 'Signing in…' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByLabelText('Email')).toBeDisabled();
  });

  it('counts a rate limit down on the button, keeps fields editable and announces once', () => {
    const { update } = renderPage(signInView({ problem: 'RATE_LIMITED', retryIn: '0:42' }));
    expect(screen.getByRole('button', { name: 'Try again in 0:42' })).toBeDisabled();
    expect(screen.getByLabelText('Email')).toBeEnabled();
    const banner = screen.getByRole('alert');
    expect(banner).toHaveTextContent(
      'For your security we paused sign-in on this account for a few minutes.',
    );

    update(signInView({ problem: 'RATE_LIMITED', retryIn: '0:41' }));
    expect(screen.getByRole('button', { name: 'Try again in 0:41' })).toBeVisible();
    // The alert's spoken text keeps the first time; only the hidden visual copy ticks.
    expect(within(banner).getByText('Too many attempts — try again in 0:42.')).toHaveClass(
      'sr-only',
    );
    expect(screen.getByRole('status')).toBeEmptyDOMElement();

    update(signInView({ retryReady: true }));
    expect(screen.getByRole('status')).toHaveTextContent('You can try again now');
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  it('keeps typed values while offline', () => {
    renderPage(signInView({ problem: 'OFFLINE' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'You’re offline. Reconnect to sign in — we’ll keep what you typed.',
    );
    expect(screen.getByLabelText('Email')).toHaveValue('sara.h@example.com');
  });

  it('warns before replacing this device’s guest data', async () => {
    const view = signInView({ guestData: { positions: 3, openOrders: 1, watchlist: 7 } });
    renderPage(view);
    const dialog = screen.getByRole('dialog', {
      name: 'Signing in will replace this device’s practice data',
    });
    expect(dialog).toHaveTextContent(
      '3 positions and 1 open order on this device will be discarded',
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Sign in anyway' }));
    expect(view.actions.confirmDiscard).toHaveBeenCalledTimes(1);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(view.actions.cancelDiscard).toHaveBeenCalled();
  });

  it('reads the wrong-credentials banner in Arabic', () => {
    renderPage(signInView({ problem: 'INVALID_CREDENTIALS' }), 'ar');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('مرحبًا بعودتك');
  });
});
