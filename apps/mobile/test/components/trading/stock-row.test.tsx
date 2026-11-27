import { fireEvent, screen } from '@testing-library/react-native';
import * as reanimated from 'react-native-reanimated';

import { type StockWithQuote } from '@sarwa/contracts';

import { StockRow } from '../../../src/components/trading/stock-row';
import { renderScreen } from '../../render';

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
  marketCap: 1_000_000_000,
  quote: {
    symbol: 'AAPL',
    price: 231.48,
    prevClose: 228.65,
    bid: 231.46,
    ask: 231.5,
    bidSize: 300,
    askSize: 200,
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
    await renderScreen(<StockRow stock={apple} watched onToggleWatch={onToggleWatch} />);

    const row = screen.getByLabelText('Apple Inc., AAPL. $231.48. Up 1.24% today. In watchlist.');
    expect(row.props.accessibilityActions).toEqual([
      { name: 'toggleWatch', label: 'Remove from watchlist' },
    ]);

    await fireEvent(row, 'accessibilityAction', { nativeEvent: { actionName: 'toggleWatch' } });
    expect(onToggleWatch).toHaveBeenCalledWith('AAPL', true);
  });

  it('lets a screen reader remove a watchlist row without swiping', async () => {
    const onRemove = jest.fn();
    await renderScreen(<StockRow stock={apple} onRemove={onRemove} />);

    const row = screen.getByRole('link');
    expect(row.props.accessibilityActions).toEqual([
      { name: 'remove', label: 'Remove from watchlist' },
    ]);
    await fireEvent(row, 'accessibilityAction', { nativeEvent: { actionName: 'remove' } });
    expect(onRemove).toHaveBeenCalledWith('AAPL');
  });

  it('greys out the price while prices are stale', async () => {
    await renderScreen(<StockRow stock={apple} stale />);

    expect(screen.getByText('$231.48').props.className).toContain('text-fg-2');
  });

  it('drops the cents from six-figure prices in the list', async () => {
    await renderScreen(
      <StockRow
        stock={{ ...apple, quote: { ...apple.quote, price: 712_340.12, prevClose: 709_000 } }}
      />,
    );

    expect(screen.getByText('$712,340')).toBeOnTheScreen();
  });

  it('follows the Arabic locale and digit setting', async () => {
    await renderScreen(<StockRow stock={apple} watched onToggleWatch={jest.fn()} />, {
      locale: 'ar',
      digits: 'arab',
    });

    expect(screen.getByText('⁦$٢٣١٫٤٨⁩')).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Apple Inc\.، AAPL\. ⁦\$٢٣١٫٤٨⁩\. ارتفع/)).toHaveProp(
      'accessibilityActions',
      [{ name: 'toggleWatch', label: 'أزل من المفضلة' }],
    );
  });

  it('does not flash a recycled row that now shows another stock', async () => {
    const flash = jest.spyOn(reanimated, 'withSequence');
    await renderScreen(<StockRow stock={apple} />);
    await screen.rerender(
      <StockRow
        stock={{ ...apple, symbol: 'MSFT', quote: { ...apple.quote, symbol: 'MSFT', price: 410 } }}
      />,
    );

    expect(flash).not.toHaveBeenCalled();
  });
});
