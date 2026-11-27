import { fireEvent, render, screen } from '@testing-library/react';

import { WatchlistTable } from '../../../src/features/watchlist/watchlist-views';
import { providers } from '../../copy';
import { makeStock } from '../../fixtures';

const push = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

describe('WatchlistTable', () => {
  it('opens the stock on Enter on the row, but not on Enter on its star', () => {
    const onRemove = jest.fn();
    const { wrapper } = providers();
    render(
      <WatchlistTable
        rows={[makeStock('AAPL')]}
        stale={false}
        sort={null}
        onSort={jest.fn()}
        onRemove={onRemove}
      />,
      { wrapper },
    );
    const row = screen.getAllByRole('row')[1];
    if (!row) throw new Error('no row');

    fireEvent.keyDown(screen.getByRole('button', { name: /AAPL/ }), { key: 'Enter' });
    expect(push).not.toHaveBeenCalled();

    fireEvent.keyDown(row, { key: 'Enter' });
    expect(push).toHaveBeenCalledWith('/stocks/AAPL');
  });
});
