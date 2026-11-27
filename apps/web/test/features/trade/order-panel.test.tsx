import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type Order } from '@sarwa/contracts';

import { OrderPanel } from '../../../src/features/trade/order-panel';
import { providers } from '../../copy';
import { makeOrder, makePortfolio, makeQuote, makeStock, makeTradingStatus } from '../../fixtures';

const push = jest.fn();
jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push, replace: jest.fn() }),
  usePathname: () => '/stocks/AAPL',
}));

beforeAll(() => {
  // ≥1280 px: the ticket is the sticky side panel.
  window.matchMedia = (query: string) =>
    ({
      matches: true,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;
});

function renderPanel({
  placeOrder = jest.fn(() => new Promise<Order>(() => undefined)),
  status = makeTradingStatus(),
}: {
  placeOrder?: jest.Mock;
  status?: ReturnType<typeof makeTradingStatus> | null;
} = {}) {
  const { client, wrapper } = providers({
    api: {
      getPortfolio: () => Promise.resolve(makePortfolio()),
      getTradingStatus: () => (status ? Promise.resolve(status) : new Promise(() => undefined)),
      listStocks: () => Promise.resolve({ items: [makeStock('AAPL')] }),
      placeOrder,
    },
  });
  client.store.getState().applyQuotes([makeQuote({ ts: Date.now() })]);
  client.store.getState().setConnection({ status: 'open' });
  const view = render(<OrderPanel symbol="AAPL" />, { wrapper });
  return { ...view, placeOrder };
}

const ticket = () => screen.getByRole('region', { name: 'Order ticket' });
const amount = () => within(ticket()).getByRole('textbox', { name: 'Quantity' });

async function ready() {
  expect(await within(ticket()).findAllByText('$10,000.00')).toHaveLength(2);
}

describe('OrderPanel · entry', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/stocks/AAPL');
  });

  it('estimates a $500 market buy and enables review', async () => {
    renderPanel();
    await ready();

    await userEvent.type(amount(), '500');

    expect(within(ticket()).getByText('Est. cost')).toBeInTheDocument();
    expect(within(ticket()).getByText('$500.00')).toBeInTheDocument();
    expect(within(ticket()).getByText('$9,500.00')).toBeInTheDocument();
    expect(within(ticket()).getByText(/shares at ask \$231\.50/)).toBeInTheDocument();
    expect(within(ticket()).getByRole('button', { name: /Review buy order/ })).toBeEnabled();
  });

  it('shows a field error inline for an order under the minimum', async () => {
    renderPanel();
    await ready();

    await userEvent.type(amount(), '0.5');

    expect(within(ticket()).getByRole('alert')).toHaveTextContent(
      'Orders must be worth at least $1.00.',
    );
    expect(within(ticket()).getByRole('button', { name: 'Minimum order is $1.00' })).toBeDisabled();
  });

  it('blocks a halted symbol with the reason on the button', async () => {
    renderPanel({
      status: makeTradingStatus({
        halts: [
          { symbol: 'AAPL', source: 'admin', message: 'News pending', since: 0, resumesAt: null },
        ],
      }),
    });
    await ready();

    await userEvent.type(amount(), '500');

    expect(
      within(ticket()).getByRole('button', { name: 'Trading paused — AAPL halted' }),
    ).toBeDisabled();
    expect(within(ticket()).getByText(/New orders are rejected/)).toBeInTheDocument();
  });

  it('shows Loading on a disabled button until the trading status arrives', async () => {
    renderPanel({ status: null });
    await ready();

    await userEvent.type(amount(), '500');

    expect(within(ticket()).getByRole('button', { name: 'Loading…' })).toBeDisabled();
  });

  it('switches side with B / S and ignores them while typing', async () => {
    renderPanel();
    await ready();

    fireEvent.keyDown(document.body, { key: 's' });
    expect(within(ticket()).getByRole('radio', { name: /^Sell/ })).toBeChecked();
    expect(window.location.search).toBe('?trade=sell');

    fireEvent.keyDown(amount(), { key: 'b' });
    expect(within(ticket()).getByRole('radio', { name: /^Sell/ })).toBeChecked();

    fireEvent.keyDown(document.body, { key: 'b' });
    expect(within(ticket()).getByRole('radio', { name: 'Buy' })).toBeChecked();
  });
});

describe('OrderPanel · review', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/stocks/AAPL?trade=buy');
  });

  it('reviews on Enter, counts the quote down and places with Ctrl+Enter', async () => {
    const { placeOrder } = renderPanel();
    await ready();
    await userEvent.type(amount(), '500');
    act(() => {
      amount().blur();
    });

    fireEvent.keyDown(document.body, { key: 'Enter' });

    expect(within(ticket()).getByRole('heading', { name: 'Review order' })).toBeInTheDocument();
    expect(within(ticket()).getByText('Buy $500.00 of AAPL')).toBeInTheDocument();
    expect(within(ticket()).getByRole('progressbar', { name: 'Quote validity' })).toHaveAttribute(
      'aria-valuetext',
      expect.stringMatching(/Quote valid for 1?\d s/),
    );

    fireEvent.keyDown(document.body, { key: 'Enter', ctrlKey: true });

    expect(await within(ticket()).findByRole('button', { name: 'Sending…' })).toBeDisabled();

    expect(placeOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        symbol: 'AAPL',
        side: 'buy',
        type: 'market',
        size: { kind: 'amount', cents: 50_000 },
      }),
      'test-idempotency-key',
    );
  });

  it('asks to confirm an order that is a large share of equity', async () => {
    renderPanel();
    await ready();
    await userEvent.type(amount(), '5000{Enter}');

    expect(within(ticket()).getByText('Large order')).toBeInTheDocument();
    expect(within(ticket()).getByRole('button', { name: /Yes, place order/ })).toBeEnabled();
  });

  it('shows the filled result once the server answers', async () => {
    const placeOrder = jest.fn(() =>
      Promise.resolve(
        makeOrder({
          id: 'ord-42',
          status: 'filled',
          filledMicros: 2_159_827,
          filledNotionalCents: 50_000,
          avgFillTicks: 2_315_200,
          closedAt: Date.now(),
        }),
      ),
    );
    renderPanel({ placeOrder });
    await ready();
    await userEvent.type(amount(), '500{Enter}');
    await userEvent.click(within(ticket()).getByRole('button', { name: /Place buy order/ }));

    expect(await within(ticket()).findByText('Order filled')).toBeInTheDocument();
    expect(within(ticket()).getByText('You bought 2.159827 AAPL for $500.00')).toBeInTheDocument();
    expect(within(ticket()).getByText('ord-42')).toBeInTheDocument();
    expect(within(ticket()).getByText('+$0.02 slippage')).toBeInTheDocument();
    await userEvent.click(within(ticket()).getByRole('button', { name: 'View position' }));
    expect(push).toHaveBeenCalledWith('/portfolio');
  });
});
