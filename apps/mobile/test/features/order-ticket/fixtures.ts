import { cents } from '@sarwa/core';

import { type useOrderTicketScreen } from '../../../src/features/order-ticket/use-order-ticket-screen';

export type TicketVm = ReturnType<typeof useOrderTicketScreen>;

export function ticketVm(
  overrides: {
    step?: TicketVm['step'];
    header?: Partial<TicketVm['header']>;
    entry?: Partial<TicketVm['entry']>;
    review?: Partial<TicketVm['review']>;
    result?: TicketVm['result'];
  } = {},
): TicketVm {
  return {
    step: overrides.step ?? 'entry',
    symbol: 'AAPL',
    sector: 'tech',
    header: {
      title: 'Buy AAPL',
      pill: { state: 'open', label: 'Open · closes 4:00 PM ET', short: 'Live' },
      ...overrides.header,
    },
    entry: {
      side: 'buy',
      buyLabel: 'Buy',
      sellLabel: 'Sell · 42 sh',
      quote: { bid: 'Bid $231.46 × 300', ask: 'Ask $231.50 × 200', spread: 'Spread 0.02%' },
      type: 'market',
      tif: 'day',
      showTif: false,
      sizeMode: 'amount',
      amount: {
        prefix: '$',
        value: '500',
        suffix: '',
        empty: false,
        hint: '≈ 2.159827 shares at ask $231.50',
      },
      sizeFocused: true,
      sizeError: undefined,
      chips: [
        {
          key: '100',
          label: '$100',
          selected: false,
          amount: { key: '100', cents: cents(10_000) },
        },
        { key: '500', label: '$500', selected: true, amount: { key: '500', cents: cents(50_000) } },
        {
          key: '1000',
          label: '$1,000',
          selected: false,
          amount: { key: '1000', cents: cents(100_000) },
        },
        {
          key: 'max',
          label: 'Max',
          selected: false,
          amount: { key: 'max', cents: cents(4_000_000) },
        },
      ],
      price: null,
      gates: [],
      rows: [
        { key: 'bp', label: 'Buying power', value: '$40,000.00' },
        { key: 'fees', label: 'Est. fees', value: '$0.00' },
      ],
      bufferNote: null,
      button: { label: 'Review order', blocked: false, queued: false, disabled: false },
      ...overrides.entry,
    },
    review: {
      headline: 'Buy $500.00 of AAPL',
      subline: 'Market order · fills at the best available ask',
      rows: [
        { key: 'type', label: 'Order type', value: 'Market · Day' },
        { key: 'total', label: 'Est. total', value: '$500.00', total: true },
      ],
      countdown: { label: 'Quote valid for 7 s', fraction: 0.7 },
      note: 'Paper order on simulated prices.',
      resting: null,
      large: null,
      confirm: {
        slideLabel: 'Slide to buy',
        buttonLabel: 'Buy AAPL',
        caption: 'Screen reader: double-tap the “Buy AAPL” button instead',
        plain: false,
        sending: false,
        disabled: false,
      },
      sendingLabel: 'Sending…',
      error: null,
      ...overrides.review,
    },
    result: overrides.result ?? null,
    actions: {
      close: jest.fn(),
      setSide: jest.fn(),
      setType: jest.fn(),
      setTif: jest.fn(),
      setSizeMode: jest.fn(),
      focusSize: jest.fn(),
      focusPrice: jest.fn(),
      key: jest.fn(),
      chooseQuickAmount: jest.fn(),
      review: jest.fn(),
      back: jest.fn(),
      toggleLargeConfirm: jest.fn(),
      submit: jest.fn(),
      retry: jest.fn(),
      viewPosition: jest.fn(),
      setAlert: jest.fn(),
    },
  };
}
