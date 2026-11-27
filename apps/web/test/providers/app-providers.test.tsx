import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';

import { queryKeys, type TradingEventListener, useStocks } from '@sarwa/core';

import { HomePage } from '../../src/features/home/home-page';
import { createBrowserClient } from '../../src/lib/client';
import { AppProviders } from '../../src/providers/app-providers';
import { createTestClient, makeStock, testAuth } from '../fixtures';

jest.mock('../../src/lib/client', () => ({ createBrowserClient: jest.fn() }));
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

function StockCount() {
  return <span>{`${String(useStocks().data?.length ?? 0)} stocks`}</span>;
}

describe('AppProviders server render', () => {
  it('paints the layout snapshot on the server, so hydration has nothing to correct', () => {
    jest.mocked(createBrowserClient).mockReturnValue(createTestClient({}, testAuth()));
    const snapshot = new QueryClient();
    snapshot.setQueryData(queryKeys.stocks, [makeStock('AAPL'), makeStock('MSFT')]);

    const view = renderToString(
      <AppProviders preferences={{ locale: 'en', digits: 'latn' }}>
        <HydrationBoundary state={dehydrate(snapshot)}>
          <StockCount />
        </HydrationBoundary>
      </AppProviders>,
    );

    expect(view).toContain('2 stocks');
  });
});

describe('AppProviders session hint', () => {
  const GUEST_HERO = 'Start practicing with $100,000';
  const renderHome = (initialStatus?: 'loading' | 'guest') => {
    const { createBrowserClient: real } = jest.requireActual<{
      createBrowserClient: typeof createBrowserClient;
    }>('../../src/lib/client');
    jest.mocked(createBrowserClient).mockImplementation(real);
    const snapshot = new QueryClient();
    snapshot.setQueryData(queryKeys.stocks, [makeStock('AAPL'), makeStock('MSFT')]);
    return renderToString(
      <AppProviders preferences={{ locale: 'en', digits: 'latn' }} initialStatus={initialStatus}>
        <HydrationBoundary state={dehydrate(snapshot)}>
          <HomePage />
        </HydrationBoundary>
      </AppProviders>,
    );
  };

  it('puts the guest hero in the server HTML when there is no session cookie', () => {
    expect(renderHome('guest')).toContain(GUEST_HERO);
  });

  it('holds the hero back while a possible session is restored, so a member sees no flash', () => {
    expect(renderHome('loading')).not.toContain(GUEST_HERO);
    expect(renderHome()).not.toContain(GUEST_HERO);
  });
});

describe('AppProviders browser notifications', () => {
  it('survives a browser where the Notification constructor throws (Android Chrome)', () => {
    const listeners: TradingEventListener[] = [];
    const client = createTestClient({});
    client.market.onTradingEvent = (listener) => {
      listeners.push(listener);
      return () => undefined;
    };
    jest.mocked(createBrowserClient).mockReturnValue(client);
    const NotificationMock = jest.fn(() => {
      throw new TypeError('Illegal constructor');
    });
    Object.assign(NotificationMock, { permission: 'granted' });
    Object.defineProperty(window, 'Notification', { configurable: true, value: NotificationMock });
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });

    render(<AppProviders preferences={{ locale: 'en', digits: 'latn' }}>app</AppProviders>);
    const notification = {
      id: 'n-1',
      payload: { kind: 'market_notice', message: 'Markets close early' },
      readAt: null,
      createdAt: 1,
    };
    const event = { name: 'notification', payload: { v: 1, notification } };

    expect(() => {
      for (const listener of listeners) listener(event as Parameters<TradingEventListener>[0]);
    }).not.toThrow();
    expect(NotificationMock).toHaveBeenCalledTimes(1);
  });
});
