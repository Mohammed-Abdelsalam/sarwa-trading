import { render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactElement } from 'react';

import { useWatchToggle } from '@sarwa/core';

import { StockActions } from '../../../src/features/stock-detail/stock-actions';
import { StockHeading } from '../../../src/features/stock-detail/stock-heading';
import { providers } from '../../copy';
import { makeStock } from '../../fixtures';

const render = (ui: ReactElement) => rtlRender(ui, { wrapper: providers().wrapper });

jest.mock('@sarwa/core', () => ({
  ...jest.requireActual<object>('@sarwa/core'),
  useWatchToggle: jest.fn(),
}));

describe('StockHeading', () => {
  it('names the stock and links back to Markets without any client state', () => {
    render(
      <StockHeading
        symbol="AAPL"
        stock={makeStock('AAPL', { name: 'Apple Inc.' })}
        labels={{ markets: 'Markets', sector: 'Technology' }}
        actions={null}
      />,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Apple Inc.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Markets' })).toHaveAttribute('href', '/markets');
  });

  it('falls back to the ticker when the server could not load the stock', () => {
    render(
      <StockHeading
        symbol="AAPL"
        stock={undefined}
        labels={{ markets: 'Markets', sector: undefined }}
        actions={null}
      />,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'AAPL' })).toBeInTheDocument();
  });
});

describe('StockActions', () => {
  it('adds the stock to the watchlist from the header button', async () => {
    const toggle = jest.fn();
    jest.mocked(useWatchToggle).mockReturnValue({ watched: false, toggle });
    render(<StockActions symbol="AAPL" />);

    const button = screen.getByRole('button', { name: 'Add AAPL to watchlist' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(button);

    expect(toggle).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('link', { name: 'Alert' })).toHaveAttribute('href', '/alerts?new=AAPL');
  });
});
