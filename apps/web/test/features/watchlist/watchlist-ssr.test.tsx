import { act, screen } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';

import { queryKeys } from '@sarwa/core';

import { WatchlistPage } from '../../../src/features/watchlist/watchlist-page';
import { providers } from '../../copy';
import { makeStock, testAuth } from '../../fixtures';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/watchlist',
}));

function guestPage() {
  const getWatchlist = jest.fn(() => Promise.resolve({ symbols: ['AAPL'] }));
  const { wrapper: Wrapper, queryClient } = providers({
    api: { getWatchlist, listStocks: () => Promise.resolve({ items: [makeStock('AAPL')] }) },
    auth: testAuth(),
  });
  queryClient.setQueryData(queryKeys.stocks, [makeStock('AAPL')]);
  return {
    getWatchlist,
    ui: (
      <Wrapper>
        <WatchlistPage />
      </Wrapper>
    ),
  };
}

describe('a guest watchlist on the server', () => {
  it('renders the skeleton without asking for the list, then hydrates cleanly into it', async () => {
    const server = guestPage();
    const view = renderToString(server.ui);

    expect(view).toContain('aria-busy');
    expect(view).not.toContain('AAPL');
    expect(view).not.toContain('keep your watchlist');
    expect(server.getWatchlist).not.toHaveBeenCalled();

    const container = document.createElement('div');
    container.innerHTML = view;
    document.body.append(container);
    const onRecoverableError = jest.fn();
    const browser = guestPage();
    await act(async () => {
      hydrateRoot(container, browser.ui, { onRecoverableError });
      await Promise.resolve();
    });

    expect(await screen.findByText(/keep your watchlist/)).toBeVisible();
    expect(screen.getAllByText('AAPL').length).toBeGreaterThan(0);
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(browser.getWatchlist).toHaveBeenCalledTimes(1);
  });
});
