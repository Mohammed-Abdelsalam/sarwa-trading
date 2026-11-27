import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Text } from 'react-native';

import { type AuthIntent } from '@sarwa/core';

import { AccountOverlays } from '../../../src/features/gating/account-overlays';
import {
  GuestFeatureScreen,
  GuestPortfolioTab,
  MemberOnly,
} from '../../../src/features/gating/guest-views';
import { showToast, useToast } from '../../../src/lib/toast';
import { customer, mockApi, renderScreen, testAuth } from '../../render';

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    canGoBack: () => true,
    push: jest.fn(),
    replace: jest.fn(),
    navigate: jest.fn(),
  },
}));

const form = {
  side: 'buy' as const,
  type: 'market' as const,
  tif: 'day' as const,
  sizeMode: 'amount' as const,
  amountText: '500',
  qtyText: '',
  limitText: '',
  stopText: '',
  sellAll: false,
};

beforeEach(() => {
  jest.clearAllMocks();
  useToast.getState().hide();
});

describe('the sign-in gate', () => {
  it('names the order the guest started and keeps its amount', async () => {
    const auth = testAuth();
    await renderScreen(<AccountOverlays />, { auth });
    await act(() => {
      auth.gate.getState().open({ kind: 'order', symbol: 'AAPL', side: 'buy', form });
    });

    expect(screen.getByText('Create an account to buy AAPL')).toBeOnTheScreen();
    expect(screen.getByText('Your $500.00 AAPL order stays filled in')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Create free account' }));
    expect(auth.gate.getState().isOpen).toBe(false);
    expect(router.push).toHaveBeenCalledWith('/sign-up');
  });

  it('opens sign-in from the gate', async () => {
    const auth = testAuth();
    await renderScreen(<AccountOverlays />, { auth });
    await act(() => {
      auth.gate.getState().open({ kind: 'orders' });
    });

    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(auth.gate.getState().isOpen).toBe(false);
    expect(router.push).toHaveBeenCalledWith('/sign-in');
  });

  it.each<[AuthIntent, string]>([
    [{ kind: 'alert', symbol: 'TSLA' }, 'Create an account to get price alerts'],
    [{ kind: 'portfolio' }, 'Create an account to track your portfolio'],
    [{ kind: 'order', symbol: 'MSFT', side: 'sell' }, 'Create an account to sell MSFT'],
  ])('titles the gate for %j', async (intent, title) => {
    const auth = testAuth();
    await renderScreen(<AccountOverlays />, { auth });
    await act(() => {
      auth.gate.getState().open(intent);
    });

    expect(screen.getByText(title)).toBeOnTheScreen();
  });
});

describe('you were signed out', () => {
  it('explains a password change elsewhere and offers a reset', async () => {
    const auth = testAuth('authenticated', customer());
    await renderScreen(<AccountOverlays />, { auth });
    await act(() => {
      auth.session.getState().signOut('password_changed');
    });

    expect(screen.getByText('You were signed out')).toBeOnTheScreen();
    expect(screen.getByText(/password was changed on another device/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Reset password' }));

    expect(auth.session.getState().revokedReason).toBeNull();
    expect(router.push).toHaveBeenCalledWith('/forgot-password');
  });

  it('tells an expired session to sign in again', async () => {
    const auth = testAuth('authenticated', customer());
    await renderScreen(<AccountOverlays />, { auth });
    await act(() => {
      auth.session.getState().signOut('expired');
    });

    expect(screen.getByText('Your session expired. Sign in again to continue.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Reset password' })).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in again' }));
    expect(router.push).toHaveBeenCalledWith('/sign-in');
  });

  it('stays closed after a sign-out the user chose', async () => {
    const auth = testAuth('authenticated', customer());
    await renderScreen(<AccountOverlays />, { auth });
    await act(() => {
      auth.session.getState().signOut();
    });

    expect(screen.queryByText('You were signed out')).not.toBeOnTheScreen();
  });

  it('routes a suspended account to the suspended screen, without the sheet', async () => {
    const auth = testAuth('authenticated', customer());
    await renderScreen(<AccountOverlays />, { auth });
    await act(() => {
      auth.session.getState().suspend({
        reasonCategory: 'abuse',
        reason: 'Automated scripts placing orders.',
        at: 0,
        accountHandle: 'ACC-7F2A9C',
      });
    });

    expect(router.replace).toHaveBeenCalledWith('/suspended');
    expect(screen.queryByText('You were signed out')).not.toBeOnTheScreen();
  });
});

describe('resuming what the guest was doing', () => {
  async function resume(intent: AuthIntent, api = mockApi()) {
    const auth = testAuth();
    await auth.intents.save(intent);
    await renderScreen(<AccountOverlays />, { auth, api });
    await act(() => {
      auth.session.getState().signIn(customer());
    });
    return auth;
  }

  it('reopens the ticket filled in, never sending it, and only once', async () => {
    const auth = await resume({ kind: 'order', symbol: 'AAPL', side: 'buy', form });

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/order/new',
        params: { symbol: 'AAPL', side: 'buy', form: JSON.stringify(form) },
      });
    });
    expect(auth.gate.getState().resumed).toBeNull();
  });

  it('reopens the alert form for the symbol', async () => {
    await resume({ kind: 'alert', symbol: 'TSLA' });

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith({
        pathname: '/alerts',
        params: { symbol: 'TSLA' },
      });
    });
  });

  it.each<[AuthIntent, string]>([
    [{ kind: 'orders' }, '/orders'],
    [{ kind: 'notifications' }, '/notifications'],
  ])('lands on the screen for %j', async (intent, path) => {
    await resume(intent);

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith(path);
    });
  });

  it('switches to the Portfolio tab', async () => {
    await resume({ kind: 'portfolio' });

    await waitFor(() => {
      expect(router.navigate).toHaveBeenCalledWith('/portfolio');
    });
  });

  it('opens alerts without a symbol when the guest had none', async () => {
    await resume({ kind: 'alert' });

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith({ pathname: '/alerts', params: {} });
    });
  });
});

describe('toasts', () => {
  it('shows one line and dismisses it', async () => {
    await renderScreen(<AccountOverlays />, { auth: testAuth() });
    await act(() => {
      showToast('Profile saved');
    });

    expect(screen.getByText('Profile saved')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('Profile saved')).not.toBeOnTheScreen();
  });

  it('hides itself after a few seconds', async () => {
    jest.useFakeTimers();
    await renderScreen(<AccountOverlays />, { auth: testAuth() });
    await act(() => {
      showToast('Profile saved');
    });
    await act(() => {
      jest.advanceTimersByTime(4_000);
    });

    expect(screen.queryByText('Profile saved')).not.toBeOnTheScreen();
    jest.useRealTimers();
  });
});

describe('personal screens for a guest', () => {
  const member = <Text>member content</Text>;

  it('shows the guest version, never an error', async () => {
    await renderScreen(<MemberOnly guest={<GuestPortfolioTab />}>{member}</MemberOnly>, {
      auth: testAuth(),
    });

    expect(screen.getByText('Track a $100,000 practice portfolio')).toBeOnTheScreen();
    expect(screen.queryByText('member content')).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Create free account' }));
    expect(router.push).toHaveBeenCalledWith('/sign-up');
  });

  it('waits while the session restores', async () => {
    await renderScreen(<MemberOnly guest={<GuestPortfolioTab />}>{member}</MemberOnly>, {
      auth: testAuth('loading'),
    });

    expect(screen.queryByText('member content')).not.toBeOnTheScreen();
    expect(screen.queryByText('Track a $100,000 practice portfolio')).not.toBeOnTheScreen();
  });

  it('shows the screen to a member', async () => {
    await renderScreen(<MemberOnly guest={<GuestPortfolioTab />}>{member}</MemberOnly>, {
      auth: testAuth('authenticated', customer()),
    });

    expect(screen.getByText('member content')).toBeOnTheScreen();
  });

  it('invites a guest on the orders screen with the gate’s words', async () => {
    await renderScreen(<GuestFeatureScreen kind="orders" />, { auth: testAuth() });

    expect(screen.getByText('Create an account to place and track orders')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(router.push).toHaveBeenCalledWith('/sign-in');
  });
});
