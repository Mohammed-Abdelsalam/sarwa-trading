import { act, renderHook } from '@testing-library/react';

import { type Order, type PlaceOrderRequest } from '@sarwa/contracts';
import { type Side } from '@sarwa/domain';
import { createFormatter, getMessages, rejectionMessage } from '@sarwa/i18n';

import { queryKeys, useOrderTicket } from '../../src/hooks';
import { type I18n } from '../../src/hooks/i18n';
import { ticketEntryView, ticketResultView, ticketReviewView } from '../../src/ticket-copy';
import { makeFilledOrder, makePortfolio, makeTradingStatus } from '../trading-fixtures';
import { createTestClient, createWrapper, makeQuote, makeStock } from '../utils';

const NOW = 1_700_000_000_000;

function setup({
  side,
  placeOrder = jest.fn(),
  statusLoaded = true,
  portfolioLoaded = true,
}: {
  side?: Side;
  placeOrder?: jest.Mock;
  statusLoaded?: boolean;
  portfolioLoaded?: boolean;
} = {}) {
  jest.useFakeTimers({ now: NOW });
  const quote = makeQuote({ ts: NOW });
  const client = createTestClient({
    placeOrder,
    getPortfolio: () =>
      portfolioLoaded ? Promise.resolve(makePortfolio()) : new Promise<never>(() => undefined),
    getTradingStatus: () =>
      statusLoaded ? Promise.resolve(makeTradingStatus()) : new Promise<never>(() => undefined),
    listStocks: () => Promise.resolve({ items: [makeStock('AAPL', { quote })] }),
  });
  client.store.getState().setConnection({ status: 'open' });
  client.store.getState().applyQuotes([quote]);
  const { Wrapper, queryClient } = createWrapper(client);
  if (portfolioLoaded) queryClient.setQueryData(queryKeys.portfolio, makePortfolio());
  if (statusLoaded) queryClient.setQueryData(queryKeys.tradingStatus, makeTradingStatus());
  queryClient.setQueryData(queryKeys.stocks, [makeStock('AAPL', { quote })]);
  const view = renderHook(() => useOrderTicket({ symbol: 'AAPL', initialSide: side ?? 'buy' }), {
    wrapper: Wrapper,
  });
  return { client, ticket: () => view.result.current };
}

const advance = (ms: number) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });

afterEach(() => {
  jest.useRealTimers();
});

describe('useOrderTicket', () => {
  it('estimates a dollar buy at the ask and lets it be reviewed when nothing blocks it', () => {
    const { ticket } = setup();

    act(() => {
      ticket().setAmountText('1000');
    });

    expect(ticket().draft).toEqual({
      side: 'buy',
      type: 'market',
      tif: 'day',
      size: { kind: 'amount', cents: 100_000 },
    });
    expect(ticket().estimate).toMatchObject({
      priceTicks: 2_315_000,
      notionalCents: 100_000,
      executesNow: true,
    });
    expect(ticket().issues).toEqual([]);
    expect(ticket().blockReason).toBeNull();
    expect(ticket().canReview).toBe(true);
  });

  it('cannot be reviewed while a required field is empty', () => {
    const { ticket } = setup();

    act(() => {
      ticket().setType('limit');
      ticket().setAmountText('1000');
    });

    expect(ticket().draft).toBeNull();
    expect(ticket().canReview).toBe(false);
  });

  it('puts the connection gate before every rule issue', () => {
    const { client, ticket } = setup();

    act(() => {
      client.store.getState().setConnection({ status: 'reconnecting', attempt: 1 });
      ticket().setAmountText('20000');
    });

    expect(ticket().blockReason).toEqual({ code: 'CONNECTION_NOT_LIVE' });
    expect(ticket().issues[0]?.code).toBe('INSUFFICIENT_FUNDS');
    expect(ticket().canReview).toBe(false);
  });

  it('blocks with a neutral loading reason until the trading status has loaded', () => {
    const { ticket } = setup({ statusLoaded: false });

    act(() => {
      ticket().setAmountText('1000');
    });

    expect(ticket().blockReason).toEqual({ code: 'STATUS_LOADING' });
    expect(ticket().canReview).toBe(false);
  });

  it('gives the spread around the mid price', () => {
    const { ticket } = setup();

    expect(ticket().spreadBps).toBe(2);
  });

  it('keys each rule issue by the field it belongs to', () => {
    const { ticket } = setup();

    act(() => {
      ticket().setType('limit');
      ticket().setLimitText('100');
      ticket().setAmountText('0.5');
    });

    expect(ticket().fieldErrors.limit?.code).toBe('PRICE_COLLAR');
    expect(ticket().fieldErrors.size?.code).toBe('MIN_NOTIONAL');
    expect(ticket().blockReason?.code).toBe('PRICE_COLLAR');
  });

  it('fills Max with the buying power on a buy', () => {
    const { ticket } = setup();
    const max = ticket().quickAmounts.find((amount) => amount.key === 'max');

    act(() => {
      if (max) ticket().chooseQuickAmount(max);
    });

    expect(ticket().quickAmounts.map((amount) => amount.cents)).toEqual([
      10_000, 50_000, 100_000, 1_000_000,
    ]);
    expect(ticket().form.amountText).toBe('10000');
    expect(ticket().draft?.size).toEqual({ kind: 'amount', cents: 1_000_000 });
  });

  it('sells the whole position when Max is chosen on a sell', () => {
    const { ticket } = setup({ side: 'sell' });
    const max = ticket().quickAmounts.find((amount) => amount.key === 'max');

    act(() => {
      if (max) ticket().chooseQuickAmount(max);
    });

    expect(max?.cents).toBe(231_480);
    expect(ticket().draft?.size).toEqual({ kind: 'all' });
    expect(ticket().canReview).toBe(true);
  });

  it('turns a sell into sell-all only when what would remain is under $1 at the bid', () => {
    const { ticket } = setup({ side: 'sell' });

    act(() => {
      ticket().setAmountText('2314');
    });
    expect(ticket().draft?.size).toEqual({ kind: 'all' });

    act(() => {
      ticket().setAmountText('2300');
    });
    expect(ticket().draft?.size).toEqual({ kind: 'amount', cents: 230_000 });

    act(() => {
      ticket().setSizeMode('shares');
      ticket().setQtyText('9.999');
    });
    expect(ticket().draft?.size).toEqual({ kind: 'all' });

    act(() => {
      ticket().setQtyText('9.99');
    });
    expect(ticket().draft?.size).toEqual({ kind: 'shares', micros: 9_990_000 });
  });

  it('blocks with the loading reason, not a funds issue, while the portfolio loads', () => {
    const { ticket } = setup({ portfolioLoaded: false });

    act(() => {
      ticket().setAmountText('1000');
    });

    expect(ticket().blockReason).toEqual({ code: 'STATUS_LOADING' });
    expect(ticket().canReview).toBe(false);
  });

  it('freezes the reviewed quote and refreshes it to the latest one after 10 s', async () => {
    const { client, ticket } = setup();
    act(() => {
      ticket().setAmountText('1000');
    });

    act(() => {
      ticket().review();
    });
    act(() => {
      client.store.getState().applyQuotes([makeQuote({ price: 240, ask: 240.02, ts: NOW + 1 })]);
    });

    expect(ticket().step).toBe('review');
    expect(ticket().reviewedQuote?.price).toBe(231.48);
    expect(ticket().quoteMsLeft).toBe(10_000);

    await advance(4_000);
    expect(ticket().quoteMsLeft).toBe(6_000);

    await advance(6_000);
    expect(ticket().reviewedQuote?.price).toBe(240);
    expect(ticket().estimate?.priceTicks).toBe(2_400_200);
    expect(ticket().quoteMsLeft).toBe(10_000);
  });

  it('asks for an extra confirmation on an order over a quarter of the equity', () => {
    const { ticket } = setup();

    act(() => {
      ticket().setAmountText('5000');
    });
    expect(ticket().needsLargeConfirm).toBe(true);

    act(() => {
      ticket().setAmountText('100');
    });
    expect(ticket().needsLargeConfirm).toBe(false);
  });

  it('gives the share of equity and the buying power left after the order', () => {
    const { ticket } = setup();

    act(() => {
      ticket().setAmountText('5000');
    });

    expect(ticket().equityShareBps).toBe(4_060);
    expect(ticket().buyingPowerAfterCents).toBe(
      ticket().buyingPowerCents - (ticket().estimate?.holdCents ?? 0),
    );
    expect(ticket().quoteValidityMs).toBe(10_000);
  });

  it('adds the sale proceeds to the buying power after a sell', () => {
    const { ticket } = setup({ side: 'sell' });

    act(() => {
      ticket().setAmountText('100');
    });

    expect(ticket().buyingPowerAfterCents).toBe(ticket().buyingPowerCents + 10_000);
  });

  it('gives the collar and the distance from last for a limit price', () => {
    const { ticket } = setup();
    expect(ticket().collar).toBeNull();

    act(() => {
      ticket().setType('limit');
      ticket().setLimitText('220');
    });

    expect(ticket().collar).toEqual({ minTicks: 2_083_320, maxTicks: 2_546_280 });
    expect(ticket().distanceBps).toBe(-496);
  });

  it('flags a limit that would not execute now as resting', () => {
    const { ticket } = setup();

    act(() => {
      ticket().setType('limit');
      ticket().setLimitText('220');
      ticket().setAmountText('1000');
    });
    expect(ticket().restingLimit).toBe(true);

    act(() => {
      ticket().setLimitText('232');
    });
    expect(ticket().restingLimit).toBe(false);
  });

  it('submits with the reviewed price and shows the server result with its slippage', async () => {
    const placeOrder = jest.fn<Promise<Order>, [PlaceOrderRequest, string]>(() =>
      Promise.resolve(makeFilledOrder({ avgFillTicks: 2_317_315 })),
    );
    const { ticket } = setup({ placeOrder });
    act(() => {
      ticket().setAmountText('1000');
    });
    act(() => {
      ticket().review();
    });

    act(() => {
      ticket().submit();
    });
    await advance(10);

    expect(placeOrder).toHaveBeenCalledWith(
      {
        symbol: 'AAPL',
        side: 'buy',
        type: 'market',
        tif: 'day',
        size: { kind: 'amount', cents: 100_000 },
        quotedTicks: 2_315_000,
      },
      expect.any(String),
    );
    expect(ticket().step).toBe('result');
    expect(ticket().result).toMatchObject({
      avgFillTicks: 2_317_315,
      slippageBps: 10,
      slippageCents: 23,
    });
  });

  it('goes back to entry and resets to a blank ticket', async () => {
    const { ticket } = setup({ placeOrder: jest.fn(() => Promise.resolve(makeFilledOrder())) });
    act(() => {
      ticket().setAmountText('1000');
    });
    act(() => {
      ticket().review();
    });
    act(() => {
      ticket().backToEntry();
    });
    expect(ticket().step).toBe('entry');
    expect(ticket().reviewedQuote).toBeNull();

    act(() => {
      ticket().setSide('sell');
      ticket().reset();
    });
    await advance(10);

    expect(ticket().form.side).toBe('buy');
    expect(ticket().form.amountText).toBe('');
  });
});

describe('ticket copy', () => {
  const copy = {
    t: getMessages('en'),
    f: createFormatter({ locale: 'en' }),
    rejection: (rejection: Parameters<I18n['rejection']>[0], symbol: string) =>
      rejectionMessage(rejection as Parameters<typeof rejectionMessage>[0], 'en', 'latn', {
        symbol,
      }),
  };

  it('describes the entry: the size hint, the currency prefix and the review button', () => {
    const { ticket } = setup();
    act(() => {
      ticket().setAmountText('1000');
    });

    const entry = ticketEntryView(ticket(), { symbol: 'AAPL', status: makeTradingStatus() }, copy);

    expect(entry.size).toMatchObject({ value: '1000', prefix: '$' });
    expect(entry.size.hint).toMatch(/shares at ask \$231\.50/);
    expect(entry.price).toBeNull();
    expect(entry.reviewLabel).toBe('Review buy order');
  });

  it('describes the review: what is bought, the rows, the total and the place button', () => {
    const { ticket } = setup();
    act(() => {
      ticket().setAmountText('1000');
    });
    act(() => {
      ticket().review();
    });

    const review = ticketReviewView(ticket(), 'AAPL', copy);

    expect(review?.headline).toBe('Buy $1,000.00 of AAPL');
    expect(review?.rows.map((row) => row.key)).toEqual(['price', 'shares', 'reserved', 'fees']);
    expect(review?.total).toMatchObject({ label: 'Est. total', value: '$1,000.00' });
    expect(review?.placeLabel).toBe('Place buy order');
  });

  it('describes the result of a filled order with its fill rows', () => {
    const order = makeFilledOrder();
    const result = ticketResultView(
      order,
      { avgFillTicks: null, slippageBps: null, slippageCents: null },
      { symbol: 'AAPL', opensAt: null },
      copy,
    );

    expect(result).toMatchObject({ tone: 'pos', title: 'Order filled' });
    expect(result.rows.map((row) => row.key)).toEqual(['at', 'id']);
  });
});
