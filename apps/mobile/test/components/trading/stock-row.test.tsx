import { fireEvent, render, screen } from '@testing-library/react-native';

import { type StockWithQuote } from '@sarwa/contracts';

import { StockRow } from '../../../src/components/trading/stock-row';

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@sarwa/core', () => ({
  ...jest.requireActual<object>('@sarwa/core'),
  useQuote: () => undefined,
}));

const apple: StockWithQuote = {
  symbol: 'AAPL',
  name: 'Apple Inc.',
  sector: 'tech',
  exchange: 'NASDAQ',
  currency: 'USD',
  sparkline: [1, 2, 3],
  quote: {
    symbol: 'AAPL',
    price: 231.48,
    prevClose: 228.65,
    open: 229,
    dayHigh: 232,
    dayLow: 228,
    volume: 1,
    ts: 1,
    seq: 1,
  },
};

describe('StockRow', () => {
  it('reads as one sentence and exposes the star as an accessibility action', async () => {
    const onToggleWatch = jest.fn();
    await render(<StockRow stock={apple} watched onToggleWatch={onToggleWatch} />);

    const row = screen.getByLabelText('Apple Inc., AAPL. $231.48. Up 1.24% today. In watchlist.');
    expect(row.props.accessibilityActions).toEqual([
      { name: 'toggleWatch', label: 'Remove from watchlist' },
    ]);

    await fireEvent(row, 'accessibilityAction', { nativeEvent: { actionName: 'toggleWatch' } });
    expect(onToggleWatch).toHaveBeenCalledWith('AAPL', true);
  });

  it('greys out the price while prices are stale', async () => {
    await render(<StockRow stock={apple} stale />);

    expect(screen.getByText('$231.48').props.className).toContain('text-fg-2');
  });

  it('drops the cents from six-figure prices in the list', async () => {
    await render(
      <StockRow
        stock={{ ...apple, quote: { ...apple.quote, price: 712_340.12, prevClose: 709_000 } }}
      />,
    );

    expect(screen.getByText('$712,340')).toBeOnTheScreen();
  });
});
