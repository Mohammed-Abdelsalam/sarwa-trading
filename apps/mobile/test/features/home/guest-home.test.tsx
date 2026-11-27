import { fireEvent, screen } from '@testing-library/react-native';
import { Text as MockText } from 'react-native';

import { type StockWithQuote } from '@sarwa/contracts';

import { GuestHomeScreen, type GuestHomeView } from '../../../src/features/home/guest-home';
import { renderScreen } from '../../render';

jest.mock('../../../src/components/trading/stock-row', () => ({
  StockRow: ({ stock }: { stock: StockWithQuote }) => <MockText>{stock.symbol}</MockText>,
}));

function view(): GuestHomeView {
  return {
    startingCash: '$100,000',
    stockCount: '22',
    moverTab: 'gainers',
    movers: [{ symbol: 'NVDA' } as StockWithQuote],
    onMoverTab: jest.fn(),
    onCreateAccount: jest.fn(),
    onSignIn: jest.fn(),
  };
}

describe('GuestHomeScreen', () => {
  it('shows the hero, the three steps and live movers', async () => {
    const guest = view();
    await renderScreen(<GuestHomeScreen view={guest} />);

    expect(screen.getByText('Start practicing with $100,000')).toBeOnTheScreen();
    expect(
      screen.getByText('Trade 22 US stocks with live simulated prices — without risking a cent.'),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText(/How it works: Sign up in 30 s/)).toBeOnTheScreen();
    expect(screen.getByText('NVDA')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Create free account' }));
    expect(guest.onCreateAccount).toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    expect(guest.onSignIn).toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('radio', { name: 'Losers' }));
    expect(guest.onMoverTab).toHaveBeenCalledWith('losers');
  });
});
