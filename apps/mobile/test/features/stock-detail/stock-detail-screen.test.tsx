import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { type ReactElement, type ReactNode } from 'react';
import { type RefreshControlProps } from 'react-native';

import { type StockWithQuote } from '@sarwa/contracts';

import { StockDetailScreen } from '../../../src/features/stock-detail/stock-detail-screen';
import { useStockDetailScreen } from '../../../src/features/stock-detail/use-stock-detail-screen';
import { renderScreen } from '../../render';

jest.mock('../../../src/features/stock-detail/use-stock-detail-screen');
// The chart itself has its own test; here it only hands the toolbar a period change.
jest.mock('../../../src/features/stock-detail/price-chart', () => ({
  ChartSkeleton: () => null,
  PriceChart: ({ footer }: { footer: (change: { value: number; pct: number }) => ReactNode }) =>
    footer({ value: 5, pct: 2.5 }),
}));
jest.mock('expo-router', () => ({
  router: { navigate: jest.fn(), back: jest.fn() },
  Link: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('@sarwa/core', () => ({
  ...jest.requireActual<object>('@sarwa/core'),
  useQuote: () => undefined,
}));

const mockedHook = jest.mocked(useStockDetailScreen);

const quote = {
  symbol: 'AAPL',
  price: 110,
  prevClose: 100,
  bid: 109.99,
  ask: 110.01,
  bidSize: 300,
  askSize: 200,
  open: 100,
  dayHigh: 110,
  dayLow: 100,
  volume: 1,
  ts: 1,
  seq: 1,
};

function viewModel(
  overrides: Partial<ReturnType<typeof useStockDetailScreen>> = {},
): ReturnType<typeof useStockDetailScreen> {
  return {
    stock: { symbol: 'AAPL', name: 'Apple', sector: 'tech', exchange: 'NASDAQ', currency: 'USD' },
    quote,
    stats: null,
    week52: null,
    status: 'live',
    watched: false,
    notFound: false,
    isError: false,
    isRefreshing: false,
    sectorLabel: 'Tech',
    similar: [],
    sellLabel: 'Sell',
    chart: {
      period: '1D',
      type: 'area',
      isLoaded: true,
      enabledPeriods: ['1D', '1M'],
      scrubbed: null,
    },
    actions: {
      toggleWatch: jest.fn(),
      retry: jest.fn(),
      refresh: jest.fn(() => Promise.resolve()),
      setPeriod: jest.fn(),
      setChartType: jest.fn(),
      scrub: jest.fn(),
      share: jest.fn(),
    },
    ...overrides,
  };
}

function similar(symbol: string): StockWithQuote {
  return {
    symbol,
    name: `${symbol} Corp.`,
    sector: 'tech',
    exchange: 'NASDAQ',
    currency: 'USD',
    sparkline: [1, 2],
    marketCap: 1,
    quote: { ...quote, symbol },
  };
}

describe('StockDetailScreen', () => {
  it('tells a missing stock apart from a network error and links back to markets', async () => {
    mockedHook.mockReturnValue(viewModel({ stock: undefined, quote: undefined, notFound: true }));
    await renderScreen(<StockDetailScreen symbol="ZZZZ" />);

    expect(screen.getByText('This stock is no longer available')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Back to Markets' }));
    expect(router.navigate).toHaveBeenCalledWith('/markets');
  });

  it('offers a retry when loading fails for another reason', async () => {
    const model = viewModel({ stock: undefined, quote: undefined, isError: true });
    mockedHook.mockReturnValue(model);
    await renderScreen(<StockDetailScreen symbol="AAPL" />);

    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    expect(model.actions.retry).toHaveBeenCalledTimes(1);
  });

  it('labels the live price for screen readers without a live region', async () => {
    mockedHook.mockReturnValue(viewModel());
    await renderScreen(<StockDetailScreen symbol="AAPL" />);

    const price = screen.getByLabelText('$110.00, up 10.00% today');
    expect(price.props).not.toHaveProperty('accessibilityLiveRegion');
  });

  it('switches the chart type from the toggle', async () => {
    const model = viewModel();
    mockedHook.mockReturnValue(model);
    await renderScreen(<StockDetailScreen symbol="AAPL" />);

    expect(screen.getByRole('radio', { name: 'Area' })).toBeChecked();
    await fireEvent.press(screen.getByRole('radio', { name: 'Candlestick' }));

    expect(model.actions.setChartType).toHaveBeenCalledWith('candle');
  });

  it('shows the change over the period except on 1D', async () => {
    mockedHook.mockReturnValue(viewModel());
    const view = await renderScreen(<StockDetailScreen symbol="AAPL" />);
    expect(screen.queryByText('this period')).not.toBeOnTheScreen();

    mockedHook.mockReturnValue(viewModel({ chart: { ...viewModel().chart, period: '1M' } }));
    await view.rerender(<StockDetailScreen symbol="AAPL" />);

    expect(screen.getByText('this period')).toBeOnTheScreen();
    expect(screen.getByText('▲ +$5.00 (+2.50%)')).toBeOnTheScreen();
  });

  it('shows the price, change and labels in Arabic with Arabic-Indic digits', async () => {
    mockedHook.mockReturnValue(viewModel({ week52: { low: 100, high: 200, position: 0.25 } }));
    await renderScreen(<StockDetailScreen symbol="AAPL" />, { locale: 'ar', digits: 'arab' });

    expect(screen.getByText('⁦$١١٠٫٠٠⁩')).toBeOnTheScreen();
    expect(screen.getByLabelText('⁦$١١٠٫٠٠⁩، ارتفع ⁦١٠٫٠٠٪⁩ اليوم')).toBeOnTheScreen();
    expect(screen.getByText('نطاق ٥٢ أسبوع')).toBeOnTheScreen();
    expect(screen.getByText('⁦$١٠٠٫٠٠⁩')).toBeOnTheScreen();
    expect(screen.queryByText('$110.00')).not.toBeOnTheScreen();
  });

  it('waits for the saved chart choice before showing the chart controls', async () => {
    mockedHook.mockReturnValue(viewModel({ chart: { ...viewModel().chart, isLoaded: false } }));
    await renderScreen(<StockDetailScreen symbol="AAPL" />);

    expect(screen.queryByRole('radio', { name: 'Area' })).not.toBeOnTheScreen();
  });

  it('places the price within its 52-week range', async () => {
    mockedHook.mockReturnValue(viewModel({ week52: { low: 100, high: 200, position: 0.25 } }));
    await renderScreen(<StockDetailScreen symbol="AAPL" />);

    expect(screen.getByText('52-week range')).toBeOnTheScreen();
    expect(screen.getByLabelText('Price within the 52-week range')).toHaveAccessibilityValue({
      now: 25,
    });
  });

  it('lists similar stocks from the same sector', async () => {
    mockedHook.mockReturnValue(viewModel({ similar: [similar('MSFT'), similar('NVDA')] }));
    await renderScreen(<StockDetailScreen symbol="AAPL" />);

    expect(screen.getByText('More in Tech')).toBeOnTheScreen();
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });

  it('shares the stock from the top bar', async () => {
    const model = viewModel();
    mockedHook.mockReturnValue(model);
    await renderScreen(<StockDetailScreen symbol="AAPL" />);

    await fireEvent.press(screen.getByRole('button', { name: 'Share' }));

    expect(model.actions.share).toHaveBeenCalledTimes(1);
  });

  it('refreshes the stock on pull-to-refresh', async () => {
    const model = viewModel();
    mockedHook.mockReturnValue(model);
    await renderScreen(<StockDetailScreen symbol="AAPL" />);

    const scroll = screen.getByTestId('stock-detail-scroll');
    // Jest renders no native RefreshControl, so pull the way RN does: through its onRefresh.
    const { refreshControl } = scroll.props as {
      refreshControl: ReactElement<RefreshControlProps>;
    };
    await act(() => refreshControl.props.onRefresh?.());

    expect(model.actions.refresh).toHaveBeenCalledTimes(1);
  });
});
