import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { cents } from '@sarwa/core';

import { AuthGateDialog } from '../../../src/features/gating/auth-gate-dialog';
import {
  ClaimedToast,
  DeletionCanceledToast,
  ReadyToast,
} from '../../../src/features/gating/auth-toasts';
import { GuestTicketFooter } from '../../../src/features/gating/guest-ticket-footer';
import {
  GuestBell,
  GuestEmptyState,
  GuestPortfolioCard,
  GuestTopBarActions,
} from '../../../src/features/gating/guest-views';
import { type AuthGateView } from '../../../src/features/gating/use-auth-gate';
import { providers } from '../../copy';
import { signInView, signUpView } from '../auth/auth-fixtures';

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe = jest.fn();
    unobserve = jest.fn();
    disconnect = jest.fn();
  };
});

function gateView(overrides: Partial<AuthGateView> = {}): AuthGateView {
  return {
    intent: {
      action: 'buy',
      stock: { symbol: 'AAPL', sector: 'tech' },
      amountCents: cents(50_000),
    },
    tab: 'signUp',
    signUp: signUpView({ values: { name: '', email: '', password: '', terms: false } }),
    signIn: signInView(),
    actions: { setTab: jest.fn(), close: jest.fn() },
    ...overrides,
  };
}

const callbacks = () => ({ onCreate: jest.fn(), onSignIn: jest.fn() });

describe('AuthGateDialog', () => {
  it('titles the gate after the action and starts focus on that title', () => {
    render(<AuthGateDialog view={gateView()} />, { wrapper: providers().wrapper });
    const dialog = screen.getByRole('dialog', { name: 'Create an account to buy AAPL' });
    expect(screen.getByRole('heading', { name: 'Create an account to buy AAPL' })).toHaveFocus();
    expect(dialog).toHaveAccessibleDescription('Free · $100,000 practice cash · ready instantly');
    expect(within(dialog).getByLabelText('Password')).toHaveAccessibleDescription(
      'At least 8 characters · not a common password',
    );
    expect(within(dialog).queryByRole('meter')).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Create account & continue' })).toBeVisible();
    expect(
      within(dialog).getByText('You’ll land back on this order with $500.00 pre-filled.'),
    ).toBeVisible();
  });

  it.each([
    [{ action: 'alert' }, 'Create an account to get price alerts'],
    [{ action: 'portfolio' }, 'Create an account to track your portfolio'],
    [{ action: 'notifications' }, 'Create an account to get notifications'],
  ] as const)('titles %o', (intent, title) => {
    render(<AuthGateDialog view={gateView({ intent })} />, { wrapper: providers().wrapper });
    expect(screen.getByRole('dialog', { name: title })).toBeInTheDocument();
  });

  it('switches to sign in and closes back to the trigger', async () => {
    const view = gateView();
    const { rerender } = render(<AuthGateDialog view={view} />, { wrapper: providers().wrapper });
    await userEvent.click(screen.getByRole('radio', { name: 'Sign in' }));
    expect(view.actions.setTab).toHaveBeenCalledWith('signIn');

    rerender(<AuthGateDialog view={{ ...view, tab: 'signIn' }} />);
    expect(screen.getByRole('button', { name: 'Sign in & continue' })).toBeVisible();

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(view.actions.close).toHaveBeenCalled();
  });

  it('renders nothing while closed', () => {
    render(<AuthGateDialog view={gateView({ intent: null })} />, { wrapper: providers().wrapper });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('GuestTicketFooter', () => {
  it('turns the submit into a sign-up for this symbol', async () => {
    const onSignUp = jest.fn();
    const onSignIn = jest.fn();
    render(<GuestTicketFooter side="buy" symbol="AAPL" onSignUp={onSignUp} onSignIn={onSignIn} />, {
      wrapper: providers().wrapper,
    });
    expect(screen.getByText('Buying power — sign in')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Sign up to buy AAPL' }));
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(onSignUp).toHaveBeenCalledTimes(1);
    expect(onSignIn).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Free · $100,000 virtual cash · simulated prices')).toBeVisible();
  });

  it('reads in Arabic', () => {
    render(
      <GuestTicketFooter side="buy" symbol="AAPL" onSignUp={jest.fn()} onSignIn={jest.fn()} />,
      {
        wrapper: providers({ locale: 'ar' }).wrapper,
      },
    );
    expect(screen.getByRole('button', { name: 'سجّل لشراء AAPL' })).toBeVisible();
  });
});

describe('Guest empty states', () => {
  it.each([
    ['portfolio', 'Your portfolio lives here'],
    ['orders', 'No orders yet'],
    ['alerts', 'Price alerts need an account'],
  ] as const)('invites a guest on %s without an error style', async (kind, title) => {
    const actions = callbacks();
    render(<GuestEmptyState kind={kind} symbol="AAPL" {...actions} />, {
      wrapper: providers().wrapper,
    });
    expect(screen.getByRole('heading', { name: title })).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Create free account' }));
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(actions.onCreate).toHaveBeenCalledTimes(1);
    expect(actions.onSignIn).toHaveBeenCalledTimes(1);
  });

  it('names the stock on the alerts invite', () => {
    render(<GuestEmptyState kind="alerts" symbol="AAPL" {...callbacks()} />, {
      wrapper: providers().wrapper,
    });
    expect(
      screen.getByText('Get notified when AAPL crosses your price, even with the app closed.'),
    ).toBeVisible();
  });

  it('pitches the portfolio with three steps', () => {
    render(<GuestPortfolioCard stockCount={22} {...callbacks()} />, {
      wrapper: providers().wrapper,
    });
    expect(
      screen.getByRole('heading', { name: 'Track a $100,000 practice portfolio' }),
    ).toBeVisible();
    const steps = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(steps.map((step) => step.textContent)).toEqual([
      '1Create an accountTakes 30 seconds · no card, no KYC',
      '2Get $100,000 virtual cashReady instantly',
      '3Trade 22 US stocksMarket, limit & stop orders',
    ]);
  });
});

describe('Guest top bar', () => {
  it('offers sign in and create account', () => {
    render(<GuestTopBarActions />, { wrapper: providers().wrapper });
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/signin');
    expect(screen.getByRole('link', { name: 'Create account' })).toHaveAttribute('href', '/signup');
  });

  it('explains the bell and gates it', async () => {
    const actions = callbacks();
    render(<GuestBell {...actions} />, { wrapper: providers().wrapper });
    await userEvent.click(
      screen.getByRole('button', { name: 'Notifications — sign in to see yours' }),
    );
    expect(screen.getByText('Get notified when it matters')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Create free account' }));
    expect(actions.onCreate).toHaveBeenCalledTimes(1);
  });
});

describe('Auth toasts', () => {
  it('announces the ready account and offers a trade', async () => {
    const onTrade = jest.fn();
    render(<ReadyToast name="Sara" onTrade={onTrade} onDismiss={jest.fn()} />, {
      wrapper: providers().wrapper,
    });
    expect(screen.getByRole('status')).toHaveTextContent(
      'Your $100,000 practice account is readyWelcome, Sara. Prices are live and simulated.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Trade' }));
    expect(onTrade).toHaveBeenCalledTimes(1);
  });

  it('counts the claimed guest portfolio', () => {
    render(
      <ClaimedToast counts={{ positions: 3, openOrders: 1, watchlist: 7 }} onDismiss={jest.fn()} />,
      { wrapper: providers().wrapper },
    );
    expect(
      screen.getByText(
        'The 3 positions and 1 open order from this device are now in your account.',
      ),
    ).toBeVisible();
  });

  it('confirms a canceled deletion and dismisses', async () => {
    const onDismiss = jest.fn();
    render(<DeletionCanceledToast onDismiss={onDismiss} />, { wrapper: providers().wrapper });
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
