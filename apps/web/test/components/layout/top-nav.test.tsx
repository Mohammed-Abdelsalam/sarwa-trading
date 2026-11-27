import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TopNav } from '../../../src/components/layout/top-nav';
import { useTopNav } from '../../../src/components/layout/use-top-nav';

jest.mock('../../../src/components/layout/use-top-nav');

const mockedHook = jest.mocked(useTopNav);

function viewModel(
  overrides: Partial<ReturnType<typeof useTopNav>> = {},
): ReturnType<typeof useTopNav> {
  return {
    pathname: '/',
    status: 'live',
    theme: 'light',
    toggleTheme: jest.fn(),
    searchRef: { current: null },
    searchOpen: false,
    toggleSearch: jest.fn(),
    query: '',
    setQuery: jest.fn(),
    submit: jest.fn(),
    ...overrides,
  };
}

describe('TopNav', () => {
  it('marks the current section in every navigation', () => {
    mockedHook.mockReturnValue(viewModel({ pathname: '/watchlist' }));
    render(<TopNav />);

    for (const link of screen.getAllByRole('link', { name: 'Watchlist' })) {
      expect(link).toHaveAttribute('aria-current', 'page');
    }
    for (const link of screen.getAllByRole('link', { name: 'Markets' })) {
      expect(link).not.toHaveAttribute('aria-current');
    }
  });

  it('switches the theme from the toggle', async () => {
    const toggleTheme = jest.fn();
    mockedHook.mockReturnValue(viewModel({ toggleTheme }));
    render(<TopNav />);

    await userEvent.click(screen.getByRole('button', { name: 'Switch theme' }));

    expect(toggleTheme).toHaveBeenCalledTimes(1);
  });

  it('sends typed text and Enter to the search model', async () => {
    const setQuery = jest.fn();
    const submit = jest.fn();
    mockedHook.mockReturnValue(viewModel({ setQuery, submit }));
    render(<TopNav />);

    await userEvent.type(screen.getByRole('textbox', { name: 'Search' }), 'a{Enter}');

    expect(setQuery).toHaveBeenCalledWith('a');
    expect(submit).toHaveBeenCalledTimes(1);
  });
});
