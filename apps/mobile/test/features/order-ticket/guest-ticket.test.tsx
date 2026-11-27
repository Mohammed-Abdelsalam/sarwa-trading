import { act, renderHook } from '@testing-library/react-native';
import { router } from 'expo-router';
import { type ReactNode } from 'react';

import { type TicketForm } from '@sarwa/core';

import { useOrderTicketScreen } from '../../../src/features/order-ticket/use-order-ticket-screen';
import { Providers, testAuth } from '../../render';

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    canGoBack: () => true,
    push: jest.fn(),
    replace: jest.fn(),
    dismissTo: jest.fn(),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

const form: TicketForm = {
  side: 'sell',
  type: 'market',
  tif: 'day',
  sizeMode: 'amount',
  amountText: '500',
  qtyText: '',
  limitText: '',
  stopText: '',
  sellAll: false,
};

function wrapper(auth = testAuth()) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <Providers auth={auth}>{children}</Providers>;
  };
}

describe('the ticket for a guest', () => {
  it('keeps what the guest typed for after sign-up, without opening the gate', async () => {
    const auth = testAuth();
    const { result } = await renderHook(() => useOrderTicketScreen('AAPL', 'buy', form), {
      wrapper: wrapper(auth),
    });

    expect(result.current.entry.side).toBe('sell');
    expect(result.current.guest?.startingCash).toBe('$100,000');
    await act(() => {
      result.current.guest?.onCreateAccount();
    });

    expect(router.replace).toHaveBeenCalledWith('/sign-up');
    expect(router.push).not.toHaveBeenCalled();
    expect(auth.gate.getState().isOpen).toBe(false);
    expect(await auth.intents.take()).toEqual({
      kind: 'order',
      symbol: 'AAPL',
      side: 'sell',
      form,
    });
  });

  it('sends a guest with an account to sign in', async () => {
    const { result } = await renderHook(() => useOrderTicketScreen('AAPL', 'buy'), {
      wrapper: wrapper(),
    });
    await act(() => {
      result.current.guest?.onSignIn();
    });

    expect(router.replace).toHaveBeenCalledWith('/sign-in');
    expect(router.push).not.toHaveBeenCalled();
  });

  it('shows the review button to a member', async () => {
    const { result } = await renderHook(() => useOrderTicketScreen('AAPL', 'buy'), {
      wrapper: wrapper(testAuth('authenticated')),
    });

    expect(result.current.guest).toBeNull();
  });
});
