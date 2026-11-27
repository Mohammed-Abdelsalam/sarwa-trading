import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { heatmapTiles, topMovers } from '@sarwa/core';

import {
  GettingStartedChecklist,
  GuestHome,
  type GuestHomeView,
} from '../../../src/features/home/guest-home';
import { providers } from '../../copy';
import { makeQuote, makeStock } from '../../fixtures';

const stocks = [
  makeStock('AAPL', { quote: makeQuote({ price: 101, prevClose: 100 }) }),
  makeStock('XOM', { quote: makeQuote({ symbol: 'XOM', price: 95, prevClose: 100 }) }),
];

function guestView(): GuestHomeView {
  const tiles = heatmapTiles(stocks, (bps) => `${String(bps / 100)}%`);
  return {
    hero: {
      badge: 'Free · no card needed',
      title: 'Start practicing with $100,000',
      body: 'Trade 22 US stocks with live simulated prices.',
      bodyMobile: 'Trade 22 US stocks.',
      howItWorks: 'How it works',
      steps: [
        { key: 'signUp', label: 'Sign up in 30 s' },
        { key: 'cash', label: 'Get $100,000 virtual cash' },
        { key: 'trade', label: 'Place your first trade' },
      ],
      createAccount: 'Create free account',
      signIn: 'Sign in',
    },
    heatmap: {
      view: 'list',
      tiles,
      rows: tiles.map((tile) => ({ ...tile, direction: 'up' as const })),
    },
    movers: { tab: 'gainers', rows: topMovers(stocks, 'gainers'), isLoading: false },
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
      equityA11y: 'Equity',
    },
    actions: { setMoversTab: jest.fn(), setHeatmapView: jest.fn(), dismissBanner: jest.fn() },
  };
}

describe('GuestHome', () => {
  it('pitches the app above the live heatmap and movers', () => {
    render(<GuestHome page={guestView()} />, { wrapper: providers().wrapper });
    expect(
      screen.getByRole('heading', { level: 1, name: 'Start practicing with $100,000' }),
    ).toBeVisible();
    expect(screen.getByText('Free · no card needed')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Create free account' })).toHaveAttribute(
      'href',
      '/signup',
    );
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/signin');
    const steps = within(screen.getByRole('list', { name: 'How it works' })).getAllByRole(
      'listitem',
    );
    expect(steps).toHaveLength(3);
    expect(steps[0]).toHaveTextContent('Sign up in 30 s');
    expect(screen.getByRole('heading', { name: 'Sector heatmap' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Top movers' })).toBeVisible();
  });

  it('numbers the steps in the reader’s digits', () => {
    render(<GuestHome page={guestView()} />, { wrapper: providers({ digits: 'arab' }).wrapper });
    const steps = within(screen.getByRole('list', { name: 'How it works' })).getAllByRole(
      'listitem',
    );
    expect(steps[0]).toHaveTextContent('١');
  });
});

describe('GettingStartedChecklist', () => {
  it('ticks the account, offers a resend and points at the markets', async () => {
    const onResend = jest.fn();
    render(
      <GettingStartedChecklist
        view={{ emailVerified: false, hasTraded: false, resend: 'idle', onResend }}
      />,
      { wrapper: providers().wrapper },
    );
    const [created, verify, trade] = screen.getAllByRole('listitem');
    expect(created).toHaveTextContent('Account created · Done');
    expect(verify).toHaveAttribute('data-done', 'false');
    await userEvent.click(within(verify!).getByRole('button', { name: 'Resend link' }));
    expect(onResend).toHaveBeenCalledTimes(1);
    expect(within(trade!).getByRole('link', { name: 'Browse markets' })).toHaveAttribute(
      'href',
      '/markets',
    );
  });

  it('drops the resend once verified', () => {
    render(
      <GettingStartedChecklist
        view={{ emailVerified: true, hasTraded: false, resend: 'idle', onResend: jest.fn() }}
      />,
      { wrapper: providers().wrapper },
    );
    expect(screen.queryByRole('button', { name: 'Resend link' })).not.toBeInTheDocument();
  });
});
