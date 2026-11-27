import { fireEvent, screen } from '@testing-library/react-native';
import { type ReactNode } from 'react';

import { type StockWithQuote } from '@sarwa/contracts';
import { topMovers } from '@sarwa/core';

import { HomeScreen } from '../../../src/features/home/home-screen';
import { useHomeScreen } from '../../../src/features/home/use-home-screen';
import { renderScreen } from '../../render';

jest.mock('../../../src/features/home/use-home-screen', () => ({
  ...jest.requireActual<object>('../../../src/features/home/use-home-screen'),
  useHomeScreen: jest.fn(),
}));
jest.mock('../../../src/components/layout/app-banners', () => ({ AppBanners: () => null }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  Link: ({ children }: { children: ReactNode }) => children,
}));

const mockedHook = jest.mocked(useHomeScreen);
type Vm = ReturnType<typeof useHomeScreen>;

function stock(symbol: string, price: number, prevClose: number, volume = 1): StockWithQuote {
  return {
    symbol,
    name: `${symbol} Inc.`,
    sector: 'tech',
    exchange: 'NASDAQ',
    currency: 'USD',
    sparkline: [1, 2],
    marketCap: 1,
    quote: {
      symbol,
      price,
      prevClose,
      bid: price,
      ask: price,
      bidSize: 1,
      askSize: 1,
      open: prevClose,
      dayHigh: price,
      dayLow: price,
      volume,
      ts: 1,
      seq: 1,
    },
  };
}

function viewModel(overrides: Partial<Vm> = {}): Vm {
  return {
    greeting: 'Good afternoon',
    market: { state: 'open', label: 'Open · closes 4:00 PM ET', short: 'Live' },
    unread: 3,
    bellLabel: 'Notifications, 3 unread',
    unreadBadge: '3',
    isLoading: false,
    isError: false,
    equity: {
      value: '$104,213.55',
      today: { label: '+$812.40 (+0.79%)', direction: 'up' },
      allTime: { label: '+$4,213.55', direction: 'up' },
      buyingPower: '$38,322.10',
      unrealized: { label: '+$2,928.95', direction: 'up' },
    },
    curve: { values: [1, 2], rising: true },
    openOrders: '3',
    activeAlerts: '2 active',
    moverTab: 'gainers',
    movers: [stock('NVDA', 110, 100)],
    recent: [],
    actions: {
      setMoverTab: jest.fn(),
      retry: jest.fn(),
      openNotifications: jest.fn(),
      openOrders: jest.fn(),
      openAlerts: jest.fn(),
      openSearch: jest.fn(),
    },
    ...overrides,
  };
}

describe('HomeScreen', () => {
  it('shows the greeting, market status, paper badge and equity card', async () => {
    mockedHook.mockReturnValue(viewModel());
    await renderScreen(<HomeScreen />);

    expect(screen.getByText('Good afternoon')).toBeOnTheScreen();
    expect(screen.getByText('Open · closes 4:00 PM ET')).toBeOnTheScreen();
    expect(screen.getByText('Paper · virtual $')).toBeOnTheScreen();
    expect(screen.getByText('$104,213.55')).toBeOnTheScreen();
    expect(screen.getByText('$38,322.10')).toBeOnTheScreen();
    expect(screen.getByText('NVDA')).toBeOnTheScreen();
    expect(screen.getByText('No orders yet. Your trades will show up here.')).toBeOnTheScreen();
  });

  it('links to notifications, orders and alerts, and switches movers', async () => {
    const model = viewModel();
    mockedHook.mockReturnValue(model);
    await renderScreen(<HomeScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Notifications, 3 unread' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Open orders, 3' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Alerts, 2 active' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Losers' }));

    expect(model.actions.openNotifications).toHaveBeenCalledTimes(1);
    expect(model.actions.openOrders).toHaveBeenCalledTimes(1);
    expect(model.actions.openAlerts).toHaveBeenCalledTimes(1);
    expect(model.actions.setMoverTab).toHaveBeenCalledWith('losers');
  });

  it('shows Reconnecting instead of the session when the connection drops', async () => {
    mockedHook.mockReturnValue(
      viewModel({
        market: { state: 'reconnecting', label: 'Reconnecting…', short: 'Reconnecting…' },
      }),
    );
    await renderScreen(<HomeScreen />);

    expect(screen.getByText('Reconnecting…')).toBeOnTheScreen();
  });
});

describe('topMovers', () => {
  const stocks = [stock('A', 105, 100, 10), stock('B', 90, 100, 30), stock('C', 101, 100, 20)];
  const symbols = (list: StockWithQuote[]) => list.map((s) => s.symbol);

  it('ranks gainers, losers and the most active', () => {
    expect(symbols(topMovers(stocks, 'gainers'))).toEqual(['A', 'C', 'B']);
    expect(symbols(topMovers(stocks, 'losers'))).toEqual(['B', 'C', 'A']);
    expect(symbols(topMovers(stocks, 'active'))).toEqual(['B', 'C', 'A']);
  });
});
