import { render, screen } from '@testing-library/react';

import { WatchlistTable } from '../../../src/features/watchlist/watchlist-views';
import { providers } from '../../copy';
import { makeStock } from '../../fixtures';

describe('WatchlistTable', () => {
  it('opens each stock through one link per row, not a focusable table row', () => {
    const { wrapper } = providers();
    render(
      <WatchlistTable
        rows={[makeStock('AAPL')]}
        stale={false}
        sort={null}
        onSort={jest.fn()}
        onRemove={jest.fn()}
      />,
      { wrapper },
    );

    expect(screen.getAllByRole('row')[1]).not.toHaveAttribute('tabindex');
    expect(screen.getByRole('link', { name: /AAPL/ })).toHaveAttribute('href', '/stocks/AAPL');
    expect(screen.getByRole('button', { name: /AAPL/ })).toHaveClass('relative', 'z-10');
  });
});
