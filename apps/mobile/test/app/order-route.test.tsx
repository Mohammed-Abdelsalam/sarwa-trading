import { render, screen } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import NewOrderRoute from '../../src/app/order/new';

import type { Text } from 'react-native';

jest.mock('expo-router', () => {
  const { Text: MockText } = jest.requireActual<{ Text: typeof Text }>('react-native');
  return {
    useLocalSearchParams: jest.fn(),
    Redirect: ({ href }: { href: string }) => <MockText>{`redirect:${href}`}</MockText>,
  };
});
jest.mock('../../src/features/order-ticket/order-ticket-screen', () => {
  const { Text: MockText } = jest.requireActual<{ Text: typeof Text }>('react-native');
  return {
    OrderTicketScreen: ({
      symbol,
      side,
      initialForm,
    }: {
      symbol: string;
      side: string;
      initialForm?: { amountText: string };
    }) => <MockText>{`ticket:${symbol}:${side}:${initialForm?.amountText ?? '-'}`}</MockText>,
  };
});

const params = jest.mocked(useLocalSearchParams);

describe('NewOrderRoute', () => {
  it('opens the ticket for the symbol in the link', async () => {
    params.mockReturnValue({ symbol: 'aapl', side: 'sell' });
    await render(<NewOrderRoute />);

    expect(screen.getByText('ticket:AAPL:sell:-')).toBeOnTheScreen();
  });

  const form = {
    side: 'buy',
    type: 'market',
    tif: 'day',
    sizeMode: 'amount',
    amountText: '500',
    qtyText: '',
    limitText: '',
    stopText: '',
    sellAll: false,
  };

  it('reopens the ticket a guest filled in before signing in', async () => {
    params.mockReturnValue({ symbol: 'AAPL', side: 'buy', form: JSON.stringify(form) });
    await render(<NewOrderRoute />);

    expect(screen.getByText('ticket:AAPL:buy:500')).toBeOnTheScreen();
  });

  it.each(['{', JSON.stringify({ ...form, type: 'bogus' })])(
    'drops a form it cannot read (%s)',
    async (raw) => {
      params.mockReturnValue({ symbol: 'AAPL', side: 'buy', form: raw });
      await render(<NewOrderRoute />);

      expect(screen.getByText('ticket:AAPL:buy:-')).toBeOnTheScreen();
    },
  );

  it.each([{}, { symbol: '' }, { symbol: ['AAPL', 'MSFT'] }])(
    'sends a link without a usable symbol back to markets (%j)',
    async (search) => {
      params.mockReturnValue(search);
      await render(<NewOrderRoute />);

      expect(screen.getByText('redirect:/markets')).toBeOnTheScreen();
    },
  );
});
