import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type Route } from 'next';

import { DEFAULT_SORT, SECTOR_FILTERS } from '@sarwa/core';

import { type StockRowProps } from '../../../src/components/trading/stock-row';
import { MarketsPage } from '../../../src/features/markets/markets-page';
import { useMarketsPage } from '../../../src/features/markets/use-markets-page';
import { makeStock } from '../../fixtures';

jest.mock('../../../src/features/markets/use-markets-page');
jest.mock('../../../src/features/markets/stock-preview', () => ({ StockPreview: () => null }));
jest.mock('../../../src/components/trading/stock-row', () => ({
  StockListSkeleton: () => <div role="progressbar" aria-label="Loading stocks" />,
  StockRow: ({ stock, href, onKeyDown }: StockRowProps) => (
    <div role="listitem">
      <a href={href} data-row={stock.symbol} onKeyDown={onKeyDown}>
        {stock.symbol}
      </a>
    </div>
  ),
}));

const mockedHook = jest.mocked(useMarketsPage);

function viewModel(
  overrides: Partial<ReturnType<typeof useMarketsPage>> = {},
): ReturnType<typeof useMarketsPage> {
  return {
    rows: [],
    watched: new Set<string>(),
    selected: undefined,
    twoPane: false,
    stale: false,
    isLoading: false,
    isError: false,
    filters: { query: '', sector: 'all', sectorLabel: 'All', sort: DEFAULT_SORT },
    rowHref: (symbol) => `/stocks/${symbol}` as Route,
    actions: {
      setSector: jest.fn(),
      cycleSort: jest.fn(),
      clearFilters: jest.fn(),
      refresh: jest.fn(),
      select: undefined,
      open: jest.fn(),
      toggleWatch: jest.fn(),
    },
    ...overrides,
  };
}

describe('MarketsPage', () => {
  it('offers to clear the search when nothing matches', async () => {
    const model = viewModel({
      filters: { query: 'zzz', sector: 'all', sectorLabel: 'All', sort: DEFAULT_SORT },
    });
    mockedHook.mockReturnValue(model);
    render(<MarketsPage />);

    expect(screen.getByText('No matches for “zzz”')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(model.actions.clearFilters).toHaveBeenCalledTimes(1);
  });

  it('shows an error with retry when the list fails to load', async () => {
    const model = viewModel({ isError: true });
    mockedHook.mockReturnValue(model);
    render(<MarketsPage />);

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(screen.getByText("Couldn't load markets")).toBeInTheDocument();
    expect(model.actions.refresh).toHaveBeenCalledTimes(1);
  });

  it('filters by sector when a chip is picked', async () => {
    const model = viewModel({ rows: [makeStock('AAPL')] });
    const sector = SECTOR_FILTERS[1];
    mockedHook.mockReturnValue(model);
    render(<MarketsPage />);

    if (sector) await userEvent.click(screen.getByRole('tab', { name: sector.label }));

    expect(model.actions.setSector).toHaveBeenCalledWith(sector?.id);
  });

  it('moves between rows with the arrow keys and stars the focused row with S', async () => {
    const model = viewModel({
      rows: [makeStock('AAPL'), makeStock('NVDA')],
      watched: new Set(['NVDA']),
    });
    mockedHook.mockReturnValue(model);
    render(<MarketsPage />);

    screen.getByRole('link', { name: 'AAPL' }).focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('link', { name: 'NVDA' })).toHaveFocus();

    await userEvent.keyboard('s');
    expect(model.actions.toggleWatch).toHaveBeenCalledWith('NVDA', true);
  });

  it('selects as the arrows move and opens the full page on Enter in two-pane mode', async () => {
    const model = viewModel({ rows: [makeStock('AAPL'), makeStock('NVDA')], twoPane: true });
    model.actions.select = jest.fn();
    mockedHook.mockReturnValue(model);
    render(<MarketsPage />);

    screen.getByRole('link', { name: 'AAPL' }).focus();
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{Enter}');

    expect(model.actions.select).toHaveBeenCalledWith('NVDA');
    expect(model.actions.open).toHaveBeenCalledWith('NVDA');
  });
});
