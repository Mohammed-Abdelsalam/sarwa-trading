import { act, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode } from 'react';

import { type Alert } from '@sarwa/contracts';
import { type ApiClient, type ClientAuth } from '@sarwa/core';

import { ToastHost } from '../../../src/components/layout/toast-host';
import { AlertDialog } from '../../../src/features/alerts/alert-dialog';
import { AuthUiProvider } from '../../../src/features/gating/auth-ui';
import { useMarketsPage } from '../../../src/features/markets/use-markets-page';
import { useStockActions } from '../../../src/features/stock-detail/use-stock-detail-page';
import { OrderPanel } from '../../../src/features/trade/order-panel';
import { providers } from '../../copy';
import {
  makePortfolio,
  makeQuote,
  makeStock,
  makeTradingStatus,
  makeUser,
  testAuth,
} from '../../fixtures';

const push = jest.fn();
jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push, replace: jest.fn() }),
  usePathname: () => '/stocks/AAPL',
}));

beforeAll(() => {
  window.matchMedia = (query: string) =>
    ({
      matches: true,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;
});

beforeEach(() => {
  push.mockClear();
  window.history.replaceState(null, '', '/stocks/AAPL');
});

const api: Partial<ApiClient> = {
  getPortfolio: () => Promise.resolve(makePortfolio()),
  getTradingStatus: () => Promise.resolve(makeTradingStatus()),
  listStocks: () => Promise.resolve({ items: [makeStock('AAPL')] }),
};

function setup(auth: ClientAuth, extra: Partial<ApiClient> = {}) {
  const base = providers({ api: { ...api, ...extra }, auth });
  base.client.store.getState().applyQuotes([makeQuote({ ts: Date.now() })]);
  base.client.store.getState().setConnection({ status: 'open' });
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

const ticket = () => screen.getByRole('region', { name: 'Order ticket' });

describe('a guest at the order ticket', () => {
  it('explores the ticket, then signs up instead of submitting, keeping what was typed', async () => {
    const auth = testAuth();
    const placeOrder = jest.fn();
    render(<OrderPanel symbol="AAPL" />, { wrapper: setup(auth, { placeOrder }) });
    await userEvent.type(within(ticket()).getByRole('textbox', { name: 'Quantity' }), '500');

    expect(within(ticket()).getByText('Est. cost')).toBeInTheDocument();
    expect(within(ticket()).queryByText('Buying power')).not.toBeInTheDocument();
    expect(within(ticket()).getByText('Buying power — sign in')).toBeInTheDocument();
    expect(within(ticket()).queryByRole('button', { name: /Review/ })).not.toBeInTheDocument();
    await userEvent.click(within(ticket()).getByRole('button', { name: 'Sign up to buy AAPL' }));

    expect(auth.gate.getState()).toMatchObject({
      isOpen: true,
      intent: { kind: 'order', symbol: 'AAPL', side: 'buy', form: { amountText: '500' } },
    });
    expect(placeOrder).not.toHaveBeenCalled();
  });

  it('opens the gate on the sign-in tab from the ticket', async () => {
    const auth = testAuth();
    render(<OrderPanel symbol="AAPL" />, { wrapper: setup(auth) });
    await userEvent.click(within(ticket()).getByRole('button', { name: 'Sign in' }));

    expect(auth.gate.getState().isOpen).toBe(true);
  });

  it('reopens the ticket prefilled after sign-in and never sends it', async () => {
    const auth = testAuth();
    await auth.intents.save({
      kind: 'order',
      symbol: 'AAPL',
      side: 'sell',
      form: {
        side: 'sell',
        type: 'limit',
        tif: 'gtc',
        sizeMode: 'shares',
        amountText: '',
        qtyText: '2',
        limitText: '240',
        stopText: '',
        sellAll: false,
      },
    });
    const placeOrder = jest.fn();
    const { unmount } = render(<OrderPanel symbol="AAPL" />, {
      wrapper: setup(auth, { placeOrder }),
    });

    act(() => {
      auth.session.getState().signIn(makeUser());
    });
    await waitFor(() => {
      expect(within(ticket()).getByRole('radio', { name: /^Sell/ })).toBeChecked();
    });
    expect(within(ticket()).getByRole('textbox', { name: 'Quantity' })).toHaveValue('2');
    expect(within(ticket()).getByRole('radio', { name: 'Limit' })).toBeChecked();
    expect(push).toHaveBeenCalledWith('/stocks/AAPL?trade=sell');
    expect(placeOrder).not.toHaveBeenCalled();

    unmount();
    render(<OrderPanel symbol="AAPL" />, { wrapper: setup(auth, { placeOrder }) });
    expect(within(ticket()).getByRole('radio', { name: /^Buy/ })).toBeChecked();
    expect(within(ticket()).getByRole('textbox', { name: 'Quantity' })).toHaveValue('');
  });
});

describe('a guest elsewhere', () => {
  it('stars a stock without the gate', async () => {
    const auth = testAuth();
    const symbols: string[] = [];
    const addToWatchlist = jest.fn((symbol: string) => {
      symbols.push(symbol);
      return Promise.resolve();
    });
    const getWatchlist = () => Promise.resolve({ symbols: [...symbols] });
    const { result } = renderHook(() => useStockActions('AAPL'), {
      wrapper: setup(auth, { getWatchlist, addToWatchlist }),
    });

    expect(result.current.labels.watchA11y).toBe('Add AAPL to watchlist');
    act(() => {
      result.current.toggleWatch();
    });
    await waitFor(() => {
      expect(result.current.watched).toBe(true);
    });
    expect(addToWatchlist).toHaveBeenCalledWith('AAPL');
    expect(auth.gate.getState().isOpen).toBe(false);
  });

  it('stars a Markets row without the gate', async () => {
    const auth = testAuth();
    const addToWatchlist = jest.fn(() => Promise.resolve());
    const { result } = renderHook(() => useMarketsPage(), {
      wrapper: setup(auth, {
        getWatchlist: () => Promise.resolve({ symbols: [] }),
        addToWatchlist,
      }),
    });

    act(() => {
      result.current.actions.toggleWatch('AAPL', false);
    });
    await waitFor(() => {
      expect(addToWatchlist).toHaveBeenCalledWith('AAPL');
    });
    expect(auth.gate.getState().isOpen).toBe(false);
  });

  it('brings an alert back with its condition and price after sign-in', async () => {
    const auth = testAuth();
    await auth.intents.save({
      kind: 'alert',
      symbol: 'AAPL',
      condition: 'price_below',
      target: '220',
    });
    const createAlert = jest.fn(() => Promise.resolve({} as Alert));
    render(<AlertDialog initialSymbol="AAPL" onClose={jest.fn()} />, {
      wrapper: setup(auth, {
        createAlert,
        listAlerts: () => Promise.resolve({ items: [], activeCount: 0, limit: 50 }),
      }),
    });

    act(() => {
      auth.session.getState().signIn(makeUser());
    });
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Target price' })).toHaveValue('220');
    });
    expect(screen.getByRole('radio', { name: 'Price below' })).toBeChecked();
    expect(createAlert).not.toHaveBeenCalled();
  });
});
