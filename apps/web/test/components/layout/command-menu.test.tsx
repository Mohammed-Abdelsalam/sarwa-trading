import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CommandMenu } from '../../../src/components/layout/command-menu';
import {
  buildCommands,
  type CommandContext,
  useCommandPalette,
} from '../../../src/components/layout/use-command-palette';
import { testCopy } from '../../copy';
import { makeQuote, makeStock } from '../../fixtures';

jest.mock('../../../src/components/layout/use-command-palette', () => ({
  ...jest.requireActual<object>('../../../src/components/layout/use-command-palette'),
  useCommandPalette: jest.fn(),
}));

const copy = testCopy();
const stocks = [
  makeStock('NVDA', {
    name: 'NVIDIA Corp.',
    quote: makeQuote({ symbol: 'NVDA', price: 142.87, prevClose: 138.16 }),
  }),
  makeStock('NFLX', { name: 'Netflix', sector: 'media' }),
  makeStock('AAPL', { name: 'Apple Inc.' }),
];

function context(query: string, overrides: Partial<CommandContext> = {}): CommandContext {
  return {
    query,
    stocks,
    owned: (symbol) => (symbol === 'NVDA' ? 120_000_000 : null),
    watched: new Set(['AAPL']),
    copy,
    go: jest.fn(),
    watch: jest.fn(),
    toggleTheme: jest.fn(),
    ...overrides,
  };
}

const labels = (groups: ReturnType<typeof buildCommands>) =>
  Object.fromEntries(groups.map((group) => [group.group, group.items.map((item) => item.label)]));

describe('buildCommands', () => {
  it('turns "buy nv" into a buy action for the best match only', () => {
    const groups = labels(buildCommands(context('buy nv')));

    expect(groups.Actions).toEqual(['Buy NVDA — NVIDIA Corp.']);
    expect(groups.Stocks).toEqual([]);
    expect(groups.Navigate).toEqual([]);
  });

  it('offers every action, matching stocks with holdings, and page search for a plain query', () => {
    const groups = buildCommands(context('n'));
    const byGroup = labels(groups);

    expect(byGroup.Actions).toEqual([
      'Buy NVDA — NVIDIA Corp.',
      'Sell NVDA — NVIDIA Corp.',
      'Set alert for NVDA',
      'Add NVDA to watchlist',
    ]);
    expect(byGroup.Stocks).toEqual(['NVDA · NVIDIA Corp.', 'NFLX · Netflix', 'AAPL · Apple Inc.']);
    expect(groups[1]?.items[0]?.hint).toBe('You own 120 sh');
    expect(byGroup.Navigate).toContain('Search markets for “n”');
    expect(groups[0]?.items[0]?.hint).toMatch(/^\$142\.87 ▲ \+3\.41%$/);
  });

  it('lists pages and the theme toggle when empty, and runs them', () => {
    const ctx = context('');
    const groups = buildCommands(ctx);
    const navigate = groups[2]?.items ?? [];

    expect(navigate.map((item) => item.label)).toEqual([
      'Home',
      'Markets',
      'Portfolio',
      'Watchlist',
      'Orders',
      'Alerts',
      'Settings',
      'Toggle theme',
    ]);
    expect(navigate.find((item) => item.label === 'Orders')?.shortcut).toBe('G O');
    navigate.find((item) => item.label === 'Toggle theme')?.run();
    expect(ctx.toggleTheme).toHaveBeenCalledTimes(1);
  });
});

describe('CommandMenu', () => {
  it('moves with the arrow keys and runs the active command on Enter', async () => {
    const ctx = context('n');
    const setOpen = jest.fn();
    jest.mocked(useCommandPalette).mockReturnValue({
      open: true,
      query: 'n',
      groups: buildCommands(ctx),
      labels: { label: 'Command palette', placeholder: 'Search', empty: 'No matches', hints: [] },
      setQuery: jest.fn(),
      setOpen,
    });
    render(<CommandMenu open onOpenChange={jest.fn()} />);

    const input = screen.getByRole('combobox', { name: 'Command palette' });
    expect(screen.getByRole('option', { name: /Buy NVDA/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await userEvent.type(input, '{ArrowDown}{ArrowDown}{Enter}');

    expect(ctx.go).toHaveBeenCalledWith('/alerts?new=NVDA');
    expect(setOpen).toHaveBeenCalledWith(false);
  });
});
