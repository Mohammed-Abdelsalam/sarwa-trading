import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode } from 'react';

import { type ApiClient, type ClientAuth } from '@sarwa/core';

import { AppShell } from '../../../src/components/layout/app-shell';
import { ToastHost } from '../../../src/components/layout/toast-host';
import { SignedOutHost } from '../../../src/features/account/signed-out-dialog';
import { SuspendedScreen } from '../../../src/features/account/suspended-page';
import { useSuspendedRedirect } from '../../../src/features/account/use-suspended-page';
import { VerifyEmailBannerHost } from '../../../src/features/account/verify-email-banner';
import { AuthGateHost } from '../../../src/features/gating/auth-gate-dialog';
import { AuthUiProvider, intentHref } from '../../../src/features/gating/auth-ui';
import { providers } from '../../copy';
import { makeStock, makeUser, sessionResponse, testAuth } from '../../fixtures';

const router = { push: jest.fn(), replace: jest.fn() };
let pathname = '/';
jest.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock('../../../src/components/layout/top-nav', () => ({ TopNav: () => <nav>top nav</nav> }));
jest.mock('../../../src/components/layout/app-banners', () => ({ AppBanners: () => null }));

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe = jest.fn();
    unobserve = jest.fn();
    disconnect = jest.fn();
  };
});

beforeEach(() => {
  router.push.mockClear();
  router.replace.mockClear();
  pathname = '/';
});

const suspension = {
  reasonCategory: 'abuse' as const,
  reason: 'Automated order spam',
  at: Date.UTC(2026, 10, 20),
  accountHandle: 'ACC-7F2E9A',
};

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

describe('You were signed out', () => {
  it('explains a revoked session and signs in again', async () => {
    const auth = testAuth({ user: makeUser() });
    render(<SignedOutHost />, { wrapper: accounts(auth) });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    act(() => {
      auth.session.getState().signOut('revoked');
    });
    const dialog = screen.getByRole('dialog', { name: 'You were signed out' });
    expect(dialog).toHaveTextContent('This device was signed out from your account settings.');
    expect(
      within(dialog).queryByRole('button', { name: 'Reset password' }),
    ).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Sign in again' }));

    expect(router.push).toHaveBeenCalledWith('/signin');
    expect(auth.session.getState().revokedReason).toBeNull();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('offers a password reset when the password changed elsewhere', async () => {
    const auth = testAuth({ user: makeUser() });
    auth.session.getState().signOut('password_changed');
    render(<SignedOutHost />, { wrapper: accounts(auth) });
    await userEvent.click(screen.getByRole('button', { name: 'Reset password' }));

    expect(router.push).toHaveBeenCalledWith('/forgot-password');
  });

  it('stays out of the way for a suspension, which has its own page', () => {
    const auth = testAuth({ user: makeUser() });
    auth.session.getState().suspend(suspension);
    render(<SignedOutHost />, { wrapper: accounts(auth) });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('suspension', () => {
  function Redirect() {
    useSuspendedRedirect();
    return null;
  }

  it('routes to /suspended as soon as the session is suspended', () => {
    pathname = '/portfolio';
    const auth = testAuth({ user: makeUser() });
    render(<Redirect />, { wrapper: accounts(auth) });
    expect(router.replace).not.toHaveBeenCalled();

    act(() => {
      auth.session.getState().suspend(suspension);
    });
    expect(router.replace).toHaveBeenCalledWith('/suspended');
  });

  it('shows the reason and category, offers support and continues as a guest', async () => {
    pathname = '/suspended';
    const auth = testAuth({ user: makeUser() });
    auth.session.getState().suspend(suspension);
    render(<SuspendedScreen />, { wrapper: accounts(auth) });

    expect(screen.getByText(/Automated trading scripts/)).toBeVisible();
    expect(screen.getByText(/Automated order spam/)).toBeVisible();
    expect(screen.getByText(/Reference ACC-7F2E9A/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Contact support' })).toHaveAttribute(
      'href',
      'mailto:support@minitrading.dev',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(auth.session.getState().status).toBe('guest');
    expect(router.replace).toHaveBeenCalledWith('/markets');
  });
});

describe('resumed intents', () => {
  it('lands each intent where it continues, never on a submit', () => {
    expect(intentHref({ kind: 'order', symbol: 'AAPL', side: 'sell' })).toBe(
      '/stocks/AAPL?trade=sell',
    );
    expect(intentHref({ kind: 'alert', symbol: 'AAPL' })).toBe('/alerts?new=AAPL');
    expect(intentHref({ kind: 'alert' })).toBe('/alerts');
    expect(intentHref({ kind: 'portfolio' })).toBe('/portfolio');
    expect(intentHref({ kind: 'orders' })).toBe('/orders');
    expect(intentHref({ kind: 'notifications' })).toBeNull();
  });

  it('reopens the order ticket after sign-in', async () => {
    const auth = testAuth();
    await auth.intents.save({ kind: 'order', symbol: 'AAPL', side: 'buy' });
    render(<div />, { wrapper: accounts(auth) });

    act(() => {
      auth.session.getState().signIn(makeUser());
    });
    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith('/stocks/AAPL?trade=buy');
    });
  });
});

describe('auth gate', () => {
  it('opens for a gated order, signs in and closes in place', async () => {
    const auth = testAuth();
    const signIn = jest.fn().mockResolvedValue(sessionResponse());
    const listStocks = jest.fn().mockResolvedValue({ items: [makeStock('AAPL')] });
    render(<AuthGateHost />, { wrapper: accounts(auth, { signIn, listStocks }) });
    act(() => {
      auth.gate.getState().open({
        kind: 'order',
        symbol: 'AAPL',
        side: 'buy',
        form: {
          side: 'buy',
          type: 'market',
          tif: 'day',
          sizeMode: 'amount',
          amountText: '500',
          qtyText: '',
          limitText: '',
          stopText: '',
          sellAll: false,
        },
      });
    });

    const dialog = await screen.findByRole('dialog', { name: 'Create an account to buy AAPL' });
    expect(
      within(dialog).getByText('You’ll land back on this order with $500.00 pre-filled.'),
    ).toBeVisible();
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Sign in' }));
    await userEvent.type(within(dialog).getByLabelText('Email'), 'sara.h@example.com');
    await userEvent.type(within(dialog).getByLabelText('Password'), 'practice-1234');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Sign in & continue' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(auth.session.getState().status).toBe('authenticated');
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('switches from sign in back to sign up and closes on Esc', async () => {
    const auth = testAuth();
    render(<AuthGateHost />, { wrapper: accounts(auth) });
    act(() => {
      auth.gate.getState().open({ kind: 'portfolio' });
    });
    const dialog = screen.getByRole('dialog', {
      name: 'Create an account to track your portfolio',
    });
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Sign in' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Sign up' }));
    expect(within(dialog).getByRole('button', { name: 'Create account & continue' })).toBeVisible();

    await userEvent.keyboard('{Escape}');
    expect(auth.gate.getState().isOpen).toBe(false);
  });
});

describe('app chrome', () => {
  it('leaves the auth pages and /suspended to their own header', () => {
    pathname = '/signin';
    const auth = testAuth();
    render(<AppShell>page</AppShell>, { wrapper: accounts(auth) });

    expect(screen.queryByText('top nav')).not.toBeInTheDocument();
    expect(screen.queryByRole('main')).not.toBeInTheDocument();
    expect(screen.getByText('page')).toBeVisible();
  });

  it('asks an unverified member to verify, and resends on request', async () => {
    const auth = testAuth({ user: makeUser({ emailVerified: false }) });
    const resendVerification = jest.fn().mockResolvedValue(undefined);
    render(<VerifyEmailBannerHost />, { wrapper: accounts(auth, { resendVerification }) });
    await userEvent.click(screen.getByRole('button', { name: 'Resend' }));

    expect(resendVerification).toHaveBeenCalledWith({});
    expect(await screen.findByRole('button', { name: /sent/i })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss verify-email message' }));
    expect(screen.queryByText(/Verify your email/)).not.toBeInTheDocument();
  });

  it('keeps the banner away from verified members and guests', () => {
    render(<VerifyEmailBannerHost />, { wrapper: accounts(testAuth({ user: makeUser() })) });
    expect(screen.queryByText(/Verify your email/)).not.toBeInTheDocument();
  });
});
