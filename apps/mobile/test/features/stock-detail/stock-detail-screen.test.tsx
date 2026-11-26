import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { StockDetailScreen } from '../../../src/features/stock-detail/stock-detail-screen';
import { useStockDetailScreen } from '../../../src/features/stock-detail/use-stock-detail-screen';

jest.mock('../../../src/features/stock-detail/use-stock-detail-screen');
jest.mock('../../../src/features/stock-detail/price-chart', () => ({ PriceChart: () => null }));
jest.mock('expo-router', () => ({ router: { navigate: jest.fn(), back: jest.fn() } }));

const mockedHook = jest.mocked(useStockDetailScreen);

function viewModel(
  overrides: Partial<ReturnType<typeof useStockDetailScreen>> = {},
): ReturnType<typeof useStockDetailScreen> {
  return {
    stock: { symbol: 'AAPL', name: 'Apple', sector: 'tech', exchange: 'NASDAQ', currency: 'USD' },
    quote: {
      symbol: 'AAPL',
      price: 110,
      prevClose: 100,
      open: 100,
      dayHigh: 110,
      dayLow: 100,
      volume: 1,
      ts: 1,
      seq: 1,
    },
    stats: null,
    status: 'live',
    watched: false,
    notFound: false,
    isError: false,
    chart: { period: '1D', enabledPeriods: ['1D'], scrubbed: null },
    actions: { toggleWatch: jest.fn(), retry: jest.fn(), setPeriod: jest.fn(), scrub: jest.fn() },
    ...overrides,
  };
}

describe('StockDetailScreen', () => {
  it('tells a missing stock apart from a network error and links back to markets', async () => {
    mockedHook.mockReturnValue(viewModel({ stock: undefined, quote: undefined, notFound: true }));
    await render(<StockDetailScreen symbol="ZZZZ" />);

    expect(screen.getByText('Stock not found')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Back to Markets' }));
    expect(router.navigate).toHaveBeenCalledWith('/');
  });

  it('offers a retry when loading fails for another reason', async () => {
    const retry = jest.fn();
    mockedHook.mockReturnValue(
      viewModel({
        stock: undefined,
        quote: undefined,
        isError: true,
        actions: { ...viewModel().actions, retry },
      }),
    );
    await render(<StockDetailScreen symbol="AAPL" />);

    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('labels the live price for screen readers without a live region', async () => {
    mockedHook.mockReturnValue(viewModel());
    await render(<StockDetailScreen symbol="AAPL" />);

    const price = screen.getByLabelText('$110.00, up 10.00% today');
    expect(price.props).not.toHaveProperty('accessibilityLiveRegion');
  });
});
