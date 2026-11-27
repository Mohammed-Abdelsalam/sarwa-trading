import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { heatmapTiles, topMovers } from '@sarwa/core';

import { HomePage } from '../../../src/features/home/home-page';
import { useHomePage } from '../../../src/features/home/use-home-page';
import { providers } from '../../copy';
import { makeQuote, makeStock } from '../../fixtures';

jest.mock('../../../src/features/home/use-home-page', () => ({
  ...jest.requireActual<object>('../../../src/features/home/use-home-page'),
  useHomePage: jest.fn(),
}));

const stocks = [
  makeStock('AAPL', {
    marketCap: 3_000,
    quote: makeQuote({ price: 101, prevClose: 100, volume: 10 }),
  }),
  makeStock('XOM', {
    marketCap: 1_000,
    quote: makeQuote({ symbol: 'XOM', price: 95, prevClose: 100, volume: 50 }),
  }),
];

function model(overrides: Partial<ReturnType<typeof useHomePage>> = {}) {
  const tiles = heatmapTiles(stocks, (bps) => `${String(bps / 100)}%`);
  return {
    mode: 'member' as const,
    isLoading: false,
    guest: null,
    checklist: null,
    banner: {
      title: 'Markets close early today',
      body: 'at 1:00 PM ET — open Day orders expire then.',
    },
    equity: {
      value: '$102,431.20',
      today: '+$1,204.10',
      todayPct: '+1.19%',
      direction: 'up' as const,
    },
    curve: { values: [1, 2, 3], loading: false },
    kpis: [
      { label: 'Buying power', value: '$40,112.00' },
      { label: 'Open orders', value: '3' },
      { label: 'Alerts', value: '3 active' },
    ],
    heatmap: {
      view: 'map' as const,
      tiles,
      rows: tiles.map((tile) => ({ ...tile, direction: 'up' as const })),
    },
    movers: { tab: 'gainers' as const, rows: topMovers(stocks, 'gainers'), isLoading: false },
    activity: [],
    labels: {
      totalEquity: 'Total equity',
      portfolioLink: 'Portfolio',
      today: 'today',
      heatmap: 'Sector heatmap',
      heatmapHint: 'Size = market cap',
      heatmapView: 'Heatmap view',
      map: 'Map',
      list: 'List',
      movers: 'Top movers',
      moverTabs: { gainers: 'Gainers', losers: 'Losers', active: 'Active' },
      activity: 'Recent activity',
      viewAll: 'All',
      noActivity: 'No activity yet.',
      dismiss: 'Dismiss',
      equityA11y: 'Equity · 5 min snapshots',
    },
    actions: { setMoversTab: jest.fn(), setHeatmapView: jest.fn(), dismissBanner: jest.fn() },
    ...overrides,
  };
}

describe('Home helpers', () => {
  it('ranks movers by move or volume and sizes tiles by market cap', () => {
    expect(topMovers(stocks, 'gainers').map((s) => s.symbol)).toEqual(['AAPL', 'XOM']);
    expect(topMovers(stocks, 'losers').map((s) => s.symbol)).toEqual(['XOM', 'AAPL']);
    expect(topMovers(stocks, 'active').map((s) => s.symbol)).toEqual(['XOM', 'AAPL']);
    expect(heatmapTiles(stocks, String).map((t) => [t.key, t.weight, t.changeLabel])).toEqual([
      ['AAPL', 0.75, '100'],
      ['XOM', 0.25, '-500'],
    ]);
  });
});

describe('HomePage', () => {
  it('shows equity, KPIs, the heatmap with printed moves and the early-close banner', async () => {
    const vm = model();
    jest.mocked(useHomePage).mockReturnValue(vm);
    render(<HomePage />, { wrapper: providers().wrapper });

    expect(screen.getByText('$102,431.20')).toBeInTheDocument();
    expect(screen.getByText('3 active')).toBeInTheDocument();
    const heatmap = screen.getByRole('list', { name: 'Sector heatmap' });
    expect(within(heatmap).getByText('-5%')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Gainers' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(vm.actions.dismissBanner).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('radio', { name: 'List' }));
    expect(vm.actions.setHeatmapView).toHaveBeenCalledWith('list');
  });
});
