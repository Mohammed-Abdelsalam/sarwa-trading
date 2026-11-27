import { render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactElement } from 'react';

import { type StockRowProps } from '../../../src/components/trading/stock-row';
import { useWatchlistPage } from '../../../src/features/watchlist/use-watchlist-page';
import { WatchlistPage } from '../../../src/features/watchlist/watchlist-page';
import { providers } from '../../copy';
import { makeStock } from '../../fixtures';

const render = (ui: ReactElement, options?: Parameters<typeof providers>[0]) =>
  rtlRender(ui, { wrapper: providers(options).wrapper });

jest.mock('../../../src/features/watchlist/use-watchlist-page');
jest.mock('../../../src/components/trading/stock-row', () => ({
  StockListSkeleton: () => null,
  StockRow: ({ stock }: StockRowProps) => <div role="listitem">{stock.symbol}</div>,
}));
jest.mock('../../../src/features/watchlist/watchlist-views', () => ({
  ...jest.requireActual<object>('../../../src/features/watchlist/watchlist-views'),
  WatchlistTable: () => <div>table view</div>,
  WatchlistGrid: () => <div>grid view</div>,
}));

const mockedHook = jest.mocked(useWatchlistPage);

function viewModel(
  overrides: Partial<ReturnType<typeof useWatchlistPage>> = {},
): ReturnType<typeof useWatchlistPage> {
  return {
    rows: [],
    average: null,
    stale: false,
    isLoading: false,
    isError: false,
    view: 'table',
    sort: null,
    removed: null,
    dismissLabel: 'Dismiss',
    actions: {
      retry: jest.fn(),
      setView: jest.fn(),
      setSort: jest.fn(),
      sortBy: jest.fn(),
      remove: jest.fn(),
      undo: jest.fn(),
      dismissUndo: jest.fn(),
    },
    ...overrides,
  };
}

describe('WatchlistPage', () => {
  it('invites the user to browse markets when nothing is starred', () => {
    mockedHook.mockReturnValue(viewModel());
    render(<WatchlistPage />);

    expect(screen.getByRole('heading', { name: 'Your watchlist is empty' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse markets' })).toHaveAttribute(
      'href',
      '/markets',
    );
  });

  it('shows an error with retry instead of the empty state when loading fails', async () => {
    const model = viewModel({ isError: true });
    mockedHook.mockReturnValue(model);
    render(<WatchlistPage />);

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(screen.queryByText('Your watchlist is empty')).not.toBeInTheDocument();
    expect(model.actions.retry).toHaveBeenCalledTimes(1);
  });

  it('switches between table and grid views', async () => {
    const model = viewModel({ rows: [makeStock('AAPL')] });
    mockedHook.mockReturnValue(model);
    render(<WatchlistPage />);

    expect(screen.getByText('table view')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Grid view' }));
    expect(model.actions.setView).toHaveBeenCalledWith('grid');
  });

  it('offers undo after a stock is removed', async () => {
    const model = viewModel({ rows: [makeStock('NVDA')], removed: 'AAPL' });
    mockedHook.mockReturnValue(model);
    render(<WatchlistPage />);

    expect(screen.getByText('AAPL removed from Watchlist')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(model.actions.undo).toHaveBeenCalledTimes(1);
    expect(model.actions.dismissUndo).toHaveBeenCalledTimes(1);
  });

  it('shows the count and average move in Arabic with Arabic-Indic digits', () => {
    mockedHook.mockReturnValue(
      viewModel({ rows: [makeStock('AAPL'), makeStock('NVDA')], average: 1.24 }),
    );
    render(<WatchlistPage />, { locale: 'ar', digits: 'arab' });

    expect(screen.getByRole('heading', { name: 'المفضلة' })).toBeInTheDocument();
    expect(screen.getByText(/سهمان/)).toHaveTextContent('المتوسط اليوم');
    expect(screen.getByText('▲ ⁦+١٫٢٤٪⁩')).toBeInTheDocument();
  });
});
