import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type Order } from '@sarwa/contracts';

import { OrdersPage } from '../../../src/features/orders/orders-page';
import { providers } from '../../copy';
import { makeOrder, makePortfolio, makeStock, makeTradingStatus } from '../../fixtures';

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

const now = Date.now();
const partial = makeOrder({
  id: 'o_8ef3',
  symbol: 'XOM',
  side: 'sell',
  type: 'limit',
  status: 'partially_filled',
  qtyMicros: 15_000_000,
  amountCents: null,
  limitTicks: 1_165_000,
  filledMicros: 8_000_000,
  filledNotionalCents: 93_215,
  avgFillTicks: 1_165_200,
  fills: [
    {
      id: 'f1',
      qtyMicros: 5_000_000,
      priceTicks: 1_165_000,
      notionalCents: 58_250,
      realizedCents: -1_200,
      at: now,
    },
    {
      id: 'f2',
      qtyMicros: 3_000_000,
      priceTicks: 1_165_500,
      notionalCents: 34_965,
      realizedCents: -705,
      at: now,
    },
  ],
  createdAt: now,
  updatedAt: now,
});
const filled = makeOrder({
  id: 'o_8f21',
  status: 'filled',
  filledMicros: 2_159_827,
  filledNotionalCents: 50_000,
  avgFillTicks: 2_315_200,
  createdAt: now,
  closedAt: now,
});

function renderPage(cancelOrder = jest.fn()) {
  const lists: Record<string, Order[]> = {
    all: [partial, filled],
    open: [partial],
    filled: [filled],
  };
  const { wrapper } = providers({
    api: {
      listOrders: (query) =>
        Promise.resolve({ items: lists[query?.filter ?? 'all'] ?? [], nextCursor: null }),
      getOrder: (id) => Promise.resolve(id === partial.id ? partial : filled),
      cancelOrder,
      getPortfolio: () => Promise.resolve(makePortfolio()),
      getTradingStatus: () => Promise.resolve(makeTradingStatus()),
      listStocks: () =>
        Promise.resolve({ items: [makeStock('XOM', { sector: 'energy' }), makeStock('AAPL')] }),
    },
  });
  return render(<OrdersPage />, { wrapper });
}

describe('OrdersPage', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/orders');
  });

  it('lists orders with side, type, status and a cancel action on open rows', async () => {
    renderPage();

    const row = await screen.findByRole('row', { name: /o_8ef3|XOM/ });
    expect(row).toHaveTextContent('SELL');
    expect(row).toHaveTextContent('Limit $116.50 · Day');
    expect(row).toHaveTextContent('15 sh');
    expect(
      within(row).getByText('Partially filled', { selector: '[data-status]' }),
    ).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Cancel XOM order' })).toBeInTheDocument();

    const done = screen.getByRole('row', { name: /AAPL/ });
    expect(done).toHaveTextContent('Filled @ $231.52');
    expect(within(done).queryByRole('button', { name: /Cancel/ })).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Open · 1' })).toBeInTheDocument();
  });

  it('opens the drawer with fill progress, timeline and realized P&L', async () => {
    window.history.replaceState(null, '', '/orders?order=o_8ef3');
    renderPage();

    const drawer = await screen.findByRole('dialog', { name: 'Sell XOM · Limit' });
    expect(
      await within(drawer).findByRole('progressbar', { name: 'Filled 8 of 15' }),
    ).toBeInTheDocument();
    expect(within(drawer).getByText('Filled 5 @ $116.50')).toBeInTheDocument();
    expect(within(drawer).getByText('Working · 7 remaining')).toBeInTheDocument();
    expect(within(drawer).getByText('Proceeds so far')).toBeInTheDocument();
    expect(within(drawer).getByText('$932.15')).toBeInTheDocument();
    expect(within(drawer).getByText('−$19.05')).toHaveClass('text-neg');
    expect(within(drawer).getByRole('button', { name: 'Modify' })).toBeInTheDocument();
  });

  it('reports a cancel that lost the race to a fill as a notice, not an error', async () => {
    window.history.replaceState(null, '', '/orders?order=o_8ef3');
    const cancelOrder = jest.fn(() =>
      Promise.resolve({
        outcome: 'already_filled' as const,
        order: { ...partial, status: 'filled' as const },
      }),
    );
    renderPage(cancelOrder);

    const drawer = await screen.findByRole('dialog', { name: 'Sell XOM · Limit' });
    await userEvent.click(await within(drawer).findByRole('button', { name: 'Cancel remaining' }));

    expect(await within(drawer).findByText('Already filled')).toBeInTheDocument();
    expect(within(drawer).getByText(/nothing left to cancel/)).toBeInTheDocument();
    expect(within(drawer).queryByRole('alert')).not.toBeInTheDocument();
    expect(
      within(drawer).queryByRole('button', { name: 'Cancel remaining' }),
    ).not.toBeInTheDocument();
  });

  it('loads older orders on demand', async () => {
    const listOrders = jest.fn((query?: { cursor?: string }) =>
      Promise.resolve(
        query?.cursor
          ? { items: [filled], nextCursor: null }
          : { items: [partial], nextCursor: partial.id },
      ),
    );
    const { wrapper } = providers({
      api: {
        listOrders,
        getPortfolio: () => Promise.resolve(makePortfolio()),
        getTradingStatus: () => Promise.resolve(makeTradingStatus()),
        listStocks: () => Promise.resolve({ items: [makeStock('AAPL')] }),
      },
    });
    render(<OrdersPage />, { wrapper });

    await userEvent.click(await screen.findByRole('button', { name: 'Load more' }));

    expect(await screen.findByRole('row', { name: /AAPL/ })).toBeInTheDocument();
    expect(listOrders).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: partial.id }),
      expect.anything(),
    );
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });
});
