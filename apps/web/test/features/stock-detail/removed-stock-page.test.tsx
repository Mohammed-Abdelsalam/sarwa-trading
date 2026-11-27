import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { RemovedStockPage } from '../../../src/features/stock-detail/removed-stock-page';
import { useRemovedStock } from '../../../src/features/stock-detail/use-removed-stock';

jest.mock('../../../src/features/stock-detail/use-removed-stock');

const mockedHook = jest.mocked(useRemovedStock);

describe('RemovedStockPage', () => {
  it('explains the removed stock and lets the user unstar it', async () => {
    const removeFromWatchlist = jest.fn();
    mockedHook.mockReturnValue({ watched: true, removeFromWatchlist });
    render(<RemovedStockPage symbol="OLD" />);

    expect(
      screen.getByRole('heading', { name: 'This stock is no longer available' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Markets' })).toHaveAttribute('href', '/');
    await userEvent.click(screen.getByRole('button', { name: 'Remove from Watchlist' }));

    expect(removeFromWatchlist).toHaveBeenCalledTimes(1);
  });

  it('hides the unstar action when the stock is not in the watchlist', () => {
    mockedHook.mockReturnValue({ watched: false, removeFromWatchlist: jest.fn() });
    render(<RemovedStockPage symbol="OLD" />);

    expect(screen.queryByRole('button', { name: 'Remove from Watchlist' })).not.toBeInTheDocument();
  });
});
