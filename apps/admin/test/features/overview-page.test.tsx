import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { OverviewPage } from '../../src/features/overview/overview-page';
import { HttpError, makeStats, me, renderWithApi } from '../utils';

const stats = makeStats({
  topWatchlisted: [
    { symbol: 'NVDA', count: 40 },
    { symbol: 'AAPL', count: 20 },
  ],
  recentActivity: [
    {
      id: 'a1',
      actorEmail: 'maya@minitrading.dev',
      action: 'market.pause',
      entity: 'market',
      payload: {},
      ip: null,
      createdAt: new Date(Date.now() - 120_000).toISOString(),
    },
  ],
});

describe('OverviewPage', () => {
  it('shows platform KPIs, the most watchlisted stocks and recent activity', async () => {
    renderWithApi(<OverviewPage />, {
      'GET admin/auth/me': me(),
      'GET admin/stats': stats,
      'GET stocks': { items: [] },
    });

    expect(await screen.findByText('1,284')).toBeInTheDocument();
    expect(screen.getByText('3,410')).toBeInTheDocument();
    const top = screen.getByRole('list', { name: 'Top watchlisted stocks' });
    const rows = within(top).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('NVDA');
    expect(rows[0]).toHaveTextContent('40');
    expect(rows[1]).toHaveTextContent('AAPL');
    expect(screen.getByText('paused the market', { exact: false })).toHaveTextContent(
      'maya@ paused the market · market',
    );
    expect(screen.getByText('30 / 32')).toBeInTheDocument();
  });

  it('counts registered customers and guest visitors instead of devices', async () => {
    renderWithApi(<OverviewPage />, {
      'GET admin/auth/me': me(),
      'GET admin/stats': makeStats({
        registeredCustomers: 8_412,
        signedUpToday: 164,
        guestVisitors24h: 2_930,
        guestConversionBps: 610,
      }),
      'GET stocks': { items: [] },
    });

    expect(await screen.findByText('8,412')).toBeInTheDocument();
    expect(screen.getByText('Registered customers')).toBeInTheDocument();
    expect(screen.getByText('+164 signed up today')).toBeInTheDocument();
    expect(screen.getByText('Guest visitors · 24h')).toBeInTheDocument();
    expect(screen.getByText('2,930')).toBeInTheDocument();
    expect(screen.getByText('6.10% converted to sign-up')).toBeInTheDocument();
    expect(screen.queryByText('Devices')).not.toBeInTheDocument();
  });

  it('says so when no stock is watchlisted and nothing has happened yet', async () => {
    renderWithApi(<OverviewPage />, {
      'GET admin/auth/me': me(),
      'GET admin/stats': makeStats(),
      'GET stocks': { items: [] },
    });

    expect(await screen.findByText("No stocks are on anyone's watchlist yet.")).toBeInTheDocument();
    expect(screen.getByText('No admin activity yet.')).toBeInTheDocument();
  });

  it('offers a retry when the stats fail, and recovers', async () => {
    let fail = true;
    const { calls } = renderWithApi(<OverviewPage />, {
      'GET admin/auth/me': me(),
      'GET admin/stats': () => (fail ? new HttpError(500) : stats),
      'GET stocks': { items: [] },
    });

    expect(await screen.findByText("Couldn't load platform stats")).toBeInTheDocument();
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('1,284')).toBeInTheDocument();
    await waitFor(() => {
      expect(calls.filter((call) => call.path === 'admin/stats')).toHaveLength(2);
    });
  });
});
