import { fireEvent, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';

import {
  AuthGateSheet,
  type AuthGateView,
  gateCopy,
  type GateIntent,
} from '../../../src/features/gating/auth-gate-sheet';
import {
  GuestAccountScreen,
  GuestOrderFooter,
  GuestPortfolio,
} from '../../../src/features/gating/guest-views';
import { englishCopy, renderScreen } from '../../render';

jest.mock('expo-router', () => ({ router: { back: jest.fn(), canGoBack: () => true } }));

function gateView(intent: GateIntent | null): AuthGateView {
  return {
    intent,
    startingCash: '$100,000',
    onCreateAccount: jest.fn(),
    onSignIn: jest.fn(),
    onClose: jest.fn(),
  };
}

const cta = () => ({ onCreateAccount: jest.fn(), onSignIn: jest.fn() });

describe('gateCopy', () => {
  it.each<[GateIntent, string]>([
    [{ kind: 'buy', symbol: 'AAPL' }, 'Create an account to buy AAPL'],
    [{ kind: 'sell', symbol: 'AAPL' }, 'Create an account to sell AAPL'],
    [{ kind: 'alert', symbol: 'AAPL' }, 'Create an account to get price alerts'],
    [{ kind: 'portfolio' }, 'Create an account to track your portfolio'],
    [{ kind: 'orders' }, 'Create an account to place and track orders'],
    [{ kind: 'notifications' }, 'Create an account to get notifications'],
  ])('titles %o', async (intent, title) => {
    expect(gateCopy(intent, '$100,000', await englishCopy()).title).toBe(title);
  });

  it('keeps the order amount in the buy benefits', async () => {
    const copy = gateCopy(
      { kind: 'buy', symbol: 'AAPL', amount: '$500' },
      '$100,000',
      await englishCopy(),
    );

    expect(copy.benefits).toEqual([
      '$100,000 practice cash, ready instantly',
      'Same account on web and phone',
      'Your $500 AAPL order stays filled in',
    ]);
  });
});

describe('AuthGateSheet', () => {
  it('presents with a light haptic and offers both paths', async () => {
    const view = gateView({ kind: 'alert', symbol: 'AAPL' });
    await renderScreen(<AuthGateSheet view={view} />);

    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
    expect(screen.getByText('Create an account to get price alerts')).toBeOnTheScreen();
    expect(
      screen.getByText(
        'We’ll notify you when AAPL crosses your price — even when the app is closed.',
      ),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Create free account' }));
    expect(view.onCreateAccount).toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(view.onSignIn).toHaveBeenCalled();
  });

  it('stays closed without an intent', async () => {
    await renderScreen(<AuthGateSheet view={gateView(null)} />);

    expect(screen.queryByRole('button', { name: 'Create free account' })).not.toBeOnTheScreen();
  });

  it('uses the Arabic title', async () => {
    await renderScreen(<AuthGateSheet view={gateView({ kind: 'buy', symbol: 'AAPL' })} />, {
      locale: 'ar',
    });

    expect(screen.getByText('أنشئ حسابًا لشراء AAPL')).toBeOnTheScreen();
  });
});

describe('GuestOrderFooter', () => {
  it('turns the submit into sign-up', async () => {
    const view = { ...cta(), symbol: 'AAPL', side: 'buy' as const, startingCash: '$100,000' };
    await renderScreen(<GuestOrderFooter view={view} />);

    expect(
      screen.getByText(
        'Create a free account to place this order — you’ll get $100,000 in practice cash.',
      ),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Sign up to buy AAPL' }));
    expect(view.onCreateAccount).toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('link', { name: 'Already have an account? Sign in' }));
    expect(view.onSignIn).toHaveBeenCalled();
  });
});

describe('GuestPortfolio', () => {
  it('invites a guest on the Portfolio tab', async () => {
    await renderScreen(<GuestPortfolio view={{ ...cta(), startingCash: '$100,000' }} />);

    expect(screen.getByText('Track a $100,000 practice portfolio')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Create free account' })).toBeOnTheScreen();
  });
});

describe('GuestAccountScreen', () => {
  it('welcomes the guest and keeps language and theme usable', async () => {
    const view = {
      ...cta(),
      startingCash: '$100,000',
      language: 'English',
      theme: 'Follows system',
      onLanguage: jest.fn(),
      onTheme: jest.fn(),
      onAbout: jest.fn(),
    };
    await renderScreen(<GuestAccountScreen view={view} />);

    expect(screen.getByText('Welcome to Mini Trading')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Language, English' }));
    expect(view.onLanguage).toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Theme, Follows system' }));
    expect(view.onTheme).toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
    expect(view.onCreateAccount).toHaveBeenCalled();
  });
});
