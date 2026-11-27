import { render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactElement } from 'react';

import { StockDetailBody } from '../../../src/features/stock-detail/stock-detail-body';
import { useStockDetailPage } from '../../../src/features/stock-detail/use-stock-detail-page';
import { providers } from '../../copy';

const render = (ui: ReactElement, options?: Parameters<typeof providers>[0]) =>
  rtlRender(ui, { wrapper: providers(options).wrapper });

jest.mock('../../../src/features/stock-detail/use-stock-detail-page');
jest.mock('../../../src/features/stock-detail/price-chart', () => ({ PriceChart: () => null }));
jest.mock('../../../src/features/stock-detail/detail-parts', () => ({
  PriceSummary: () => null,
  KeyStats: () => null,
  RangeCard: () => null,
  SimilarStocks: () => null,
}));

const mockedHook = jest.mocked(useStockDetailPage);

function viewModel(
  overrides: Partial<ReturnType<typeof useStockDetailPage>> = {},
): ReturnType<typeof useStockDetailPage> {
  return {
    stock: undefined,
    quote: undefined,
    stats: null,
    week52: null,
    notFound: false,
    isError: false,
    retry: jest.fn(),
    watched: false,
    live: true,
    similar: [],
    chart: { period: '1D', type: 'area', enabledPeriods: ['1D', '1W'] },
    quoteLine: 'Bid $231.46 × 300 · Ask $231.50 × 200 · Spread 0.02%',
    position: null,
    labels: {
      similar: 'More in Tech',
      loadError: "Couldn't load AAPL",
      loadErrorBody: 'Check your connection and try again.',
      retry: 'Retry',
    },
    actions: {
      toggleWatch: jest.fn(),
      retry: jest.fn(),
      setPeriod: jest.fn(),
      setChartType: jest.fn(),
    },
    ...overrides,
  };
}

describe('StockDetailBody', () => {
  it('offers a retry when the stock fails to load', async () => {
    const model = viewModel({ isError: true });
    mockedHook.mockReturnValue(model);
    render(<StockDetailBody symbol="AAPL" />);

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(model.retry).toHaveBeenCalledTimes(1);
  });

  it('explains a removed stock and lets the user unstar it', async () => {
    const model = viewModel({ notFound: true, watched: true });
    mockedHook.mockReturnValue(model);
    render(<StockDetailBody symbol="OLD" />);

    expect(
      screen.getByRole('heading', { name: 'This stock is no longer available' }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remove from Watchlist' }));

    expect(model.actions.toggleWatch).toHaveBeenCalledTimes(1);
  });
});
