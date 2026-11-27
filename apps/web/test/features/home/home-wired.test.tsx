import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { HomePage } from '../../../src/features/home/home-page';
import { providers } from '../../copy';
import { makeStock, makeUser, testAuth } from '../../fixtures';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe = jest.fn();
    unobserve = jest.fn();
    disconnect = jest.fn();
  };
});

const listStocks = jest.fn().mockResolvedValue({ items: [makeStock('AAPL'), makeStock('XOM')] });

describe('Home, wired to useHomeView', () => {
  it('shows a guest the landing with the live market and asks for nothing personal', async () => {
    const getPortfolio = jest.fn();
    render(<HomePage />, {
      wrapper: providers({ api: { listStocks, getPortfolio }, auth: testAuth() }).wrapper,
    });

    expect(
      screen.getByRole('heading', { level: 1, name: 'Start practicing with $100,000' }),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Create free account' })).toHaveAttribute(
      'href',
      '/signup',
    );
    expect(screen.getByText('Get $100,000 virtual cash')).toBeVisible();
    expect(await screen.findByRole('heading', { name: 'Top movers' })).toBeVisible();
    expect(getPortfolio).not.toHaveBeenCalled();
  });

  it('holds the landing back while the session is still loading', () => {
    render(<HomePage />, {
      wrapper: providers({ api: { listStocks }, auth: testAuth({ status: 'loading' }) }).wrapper,
    });

    expect(screen.queryByRole('link', { name: 'Create free account' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Total equity' })).toBeVisible();
  });

  it('gives a new member the getting-started checklist and resends the link', async () => {
    const resendVerification = jest.fn().mockResolvedValue(undefined);
    const api = {
      listStocks,
      resendVerification,
      listOrders: jest.fn().mockResolvedValue({ items: [], nextCursor: null }),
    };
    render(<HomePage />, {
      wrapper: providers({ api, auth: testAuth({ user: makeUser({ emailVerified: false }) }) })
        .wrapper,
    });

    expect(await screen.findByRole('heading', { name: 'Get started' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Resend link' }));
    expect(resendVerification).toHaveBeenCalledWith({});
    expect(screen.queryByRole('link', { name: 'Create free account' })).not.toBeInTheDocument();
  });
});
