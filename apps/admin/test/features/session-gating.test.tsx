import { screen } from '@testing-library/react';
import { type ReactElement } from 'react';

import { PERIODS } from '@sarwa/contracts';

import { ConfigPage } from '../../src/features/config/config-page';
import { MarketPage } from '../../src/features/market/market-page';
import { StocksPage } from '../../src/features/stocks/stocks-page';
import { TradingPage } from '../../src/features/trading/trading-page';
import { makeStats, makeTrading, renderWithApi } from '../utils';

const pending = () => new Promise(() => undefined);

const pages: [string, ReactElement][] = [
  ['config', <ConfigPage key="config" />],
  ['market', <MarketPage key="market" />],
  ['trading', <TradingPage key="trading" />],
  ['stocks', <StocksPage key="stocks" />],
];

describe('view-only notice while the session loads', () => {
  it.each(pages)('stays hidden on %s until the session says VIEWER', async (_, page) => {
    renderWithApi(page, {
      'GET admin/auth/me': pending,
      'GET admin/stats': makeStats(),
      'GET app-config': { maintenanceMode: false, banner: null, enabledPeriods: [...PERIODS] },
      'GET admin/trading': makeTrading(),
      'GET stocks': { items: [] },
      'GET admin/stocks': { items: [] },
    });

    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.queryByText('View-only access.')).not.toBeInTheDocument();
    expect(screen.queryByText('Read-only')).not.toBeInTheDocument();
  });
});
