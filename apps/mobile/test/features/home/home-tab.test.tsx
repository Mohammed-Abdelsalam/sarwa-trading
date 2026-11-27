import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Text as MockText } from 'react-native';

import { type StockWithQuote } from '@sarwa/contracts';

import { HomeTab } from '../../../src/features/home/home-tab';
import { customer, mockApi, renderScreen, testAuth } from '../../render';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../../../src/components/trading/stock-row', () => ({
  StockRow: ({ stock }: { stock: StockWithQuote }) => <MockText>{stock.symbol}</MockText>,
}));
jest.mock('../../../src/features/home/home-screen', () => ({
  HomeScreen: () => <MockText>member home</MockText>,
}));

const stock = (symbol: string, price: number): StockWithQuote => ({
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
    prevClose: 100,
    bid: price,
    ask: price,
    bidSize: 1,
    askSize: 1,
    open: 100,
    dayHigh: price,
    dayLow: price,
    volume: 1,
    ts: 1,
    seq: 1,
  },
});

describe('Home tab', () => {
  it('lands a guest on the hero with live movers', async () => {
    const listStocks = () => Promise.resolve({ items: [stock('NVDA', 104), stock('TSLA', 98)] });
    await renderScreen(<HomeTab />, { auth: testAuth(), api: mockApi({ listStocks }) });

    expect(screen.getByText('Start practicing with $100,000')).toBeOnTheScreen();
    expect(screen.getByText('Get $100,000')).toBeOnTheScreen();
    expect(await screen.findByText(/Trade 2 US stocks/)).toBeOnTheScreen();
    expect(screen.getByText('NVDA')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Create free account' }));
    expect(router.push).toHaveBeenCalledWith('/sign-up');
  });

  it('gives a member the dashboard', async () => {
    await renderScreen(<HomeTab />, { auth: testAuth('authenticated', customer()) });

    expect(screen.getByText('member home')).toBeOnTheScreen();
  });
});
