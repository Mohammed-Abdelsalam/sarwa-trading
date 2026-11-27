import { fireEvent, screen } from '@testing-library/react-native';
import { Text as MockText } from 'react-native';

import { type StockWithQuote } from '@sarwa/contracts';

import { useWatchlistScreen } from '../../../src/features/watchlist/use-watchlist-screen';
import { WatchlistScreen } from '../../../src/features/watchlist/watchlist-screen';
import { renderScreen } from '../../render';

jest.mock('../../../src/features/watchlist/use-watchlist-screen');
jest.mock('../../../src/components/layout/app-banners', () => ({ AppBanners: () => null }));
jest.mock('../../../src/components/layout/screen-header', () => ({
  ScreenHeader: ({ title }: { title: string }) => <MockText>{title}</MockText>,
}));
jest.mock('../../../src/components/trading/stock-row', () => ({
  StockRow: ({ stock }: { stock: StockWithQuote }) => <MockText>{stock.symbol}</MockText>,
  StockListSkeleton: () => null,
}));
jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }));
// The native swipe gesture can't run in Jest; render the row with its action visible instead.
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => ({
  __esModule: true,
  SwipeDirection: { LEFT: 'left', RIGHT: 'right' },
  default: ({
    children,
    renderRightActions,
  }: {
    children: React.ReactNode;
    renderRightActions: () => React.ReactNode;
  }) => (
    <>
      {children}
      {renderRightActions()}
    </>
  ),
}));

const mockedHook = jest.mocked(useWatchlistScreen);

function stock(symbol: string): StockWithQuote {
  return {
    symbol,
    name: symbol,
    sector: 'tech',
    exchange: 'NASDAQ',
    currency: 'USD',
    sparkline: [1, 2],
    marketCap: 1_000_000_000,
    quote: {
      symbol,
      price: 10,
      prevClose: 9,
      bid: 9.99,
      ask: 10.01,
      bidSize: 300,
      askSize: 200,
      open: 9,
      dayHigh: 10,
      dayLow: 9,
      volume: 1,
      ts: 1,
      seq: 1,
    },
  };
}

function viewModel(
  overrides: Partial<ReturnType<typeof useWatchlistScreen>> = {},
): ReturnType<typeof useWatchlistScreen> {
  return {
    rows: [],
    average: null,
    stale: false,
    isLoading: false,
    isError: false,
    sort: null,
    removed: null,
    actions: {
      retry: jest.fn(),
      cycleSort: jest.fn(),
      remove: jest.fn(),
      undo: jest.fn(),
      dismissUndo: jest.fn(),
    },
    ...overrides,
  };
}

describe('WatchlistScreen', () => {
  it('invites the user to browse markets when nothing is starred', async () => {
    mockedHook.mockReturnValue(viewModel());
    await renderScreen(<WatchlistScreen />);

    expect(screen.getByText('Your watchlist is empty')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Browse markets' })).toBeOnTheScreen();
  });

  it('shows an error with retry instead of the empty state when loading fails', async () => {
    const model = viewModel({ isError: true });
    mockedHook.mockReturnValue(model);
    await renderScreen(<WatchlistScreen />);

    expect(screen.queryByText('Your watchlist is empty')).not.toBeOnTheScreen();
    expect(screen.getByText("Couldn't load your watchlist")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    expect(model.actions.retry).toHaveBeenCalledTimes(1);
  });

  it('lists starred stocks with the average change', async () => {
    mockedHook.mockReturnValue(viewModel({ rows: [stock('AAPL'), stock('NVDA')], average: 1.5 }));
    await renderScreen(<WatchlistScreen />);

    expect(screen.getByText('AAPL')).toBeOnTheScreen();
    expect(screen.getByText('NVDA')).toBeOnTheScreen();
    expect(screen.getByText('2 stocks')).toBeOnTheScreen();
    expect(screen.getByText('▲ +1.50%')).toBeOnTheScreen();
  });

  it('removes a stock from its swipe action', async () => {
    const model = viewModel({ rows: [stock('AAPL')] });
    mockedHook.mockReturnValue(model);
    await renderScreen(<WatchlistScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'Remove AAPL from watchlist' }));
    expect(model.actions.remove).toHaveBeenCalledWith('AAPL');
  });

  it('offers undo in a snackbar while the removal is pending, even on an empty list', async () => {
    const model = viewModel({ removed: 'AAPL' });
    mockedHook.mockReturnValue(model);
    await renderScreen(<WatchlistScreen />);

    expect(screen.getByText('AAPL removed from Watchlist')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Dismiss' }));

    expect(model.actions.undo).toHaveBeenCalledTimes(1);
    expect(model.actions.dismissUndo).toHaveBeenCalledTimes(1);
  });

  it('cycles the sort, starting from the order stocks were added in', async () => {
    const model = viewModel({ rows: [stock('AAPL')] });
    mockedHook.mockReturnValue(model);
    await renderScreen(<WatchlistScreen />);

    await fireEvent.press(
      screen.getByRole('button', { name: 'Sort by Order added, tap to change' }),
    );

    expect(model.actions.cycleSort).toHaveBeenCalledTimes(1);
  });
});
