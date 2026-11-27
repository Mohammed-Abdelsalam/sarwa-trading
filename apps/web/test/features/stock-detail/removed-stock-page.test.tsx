import { render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactElement } from 'react';

import { useWatchToggle } from '@sarwa/core';

import { RemovedStockPage } from '../../../src/features/stock-detail/removed-stock-page';
import { providers } from '../../copy';

const render = (ui: ReactElement, options?: Parameters<typeof providers>[0]) =>
  rtlRender(ui, { wrapper: providers(options).wrapper });

jest.mock('@sarwa/core', () => ({
  ...jest.requireActual<object>('@sarwa/core'),
  useWatchToggle: jest.fn(),
}));

const mockedHook = jest.mocked(useWatchToggle);

describe('RemovedStockPage', () => {
  it('explains the removed stock and lets the user unstar it', async () => {
    const toggle = jest.fn();
    mockedHook.mockReturnValue({ watched: true, toggle });
    render(<RemovedStockPage symbol="OLD" />);

    expect(
      screen.getByRole('heading', { name: 'This stock is no longer available' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Markets' })).toHaveAttribute(
      'href',
      '/markets',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Remove from Watchlist' }));

    expect(toggle).toHaveBeenCalledTimes(1);
  });

  it('hides the unstar action when the stock is not in the watchlist', () => {
    mockedHook.mockReturnValue({ watched: false, toggle: jest.fn() });
    render(<RemovedStockPage symbol="OLD" />);

    expect(screen.queryByRole('button', { name: 'Remove from Watchlist' })).not.toBeInTheDocument();
  });
});
