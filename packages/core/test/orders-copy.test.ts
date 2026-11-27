import { createFormatter, getMessages, rejectionMessage } from '@sarwa/i18n';

import { type I18n } from '../src/hooks/i18n';
import {
  cancelLabel,
  fillProgress,
  isCancellable,
  orderNote,
  orderRealized,
  orderSizeLabel,
  orderTimeline,
  orderTypeLabel,
} from '../src/orders-copy';
import { makeOrder } from './trading-fixtures';

const copy = {
  t: getMessages('en'),
  f: createFormatter({ locale: 'en' }),
  rejection: (rejection: Parameters<I18n['rejection']>[0], symbol: string) =>
    rejectionMessage(rejection as Parameters<typeof rejectionMessage>[0], 'en', 'latn', { symbol }),
};

const NOW = Date.UTC(2026, 10, 27, 20, 0);
const fill = (id: string, shares: number, priceTicks: number, realizedCents = 0) => ({
  id,
  qtyMicros: shares * 1_000_000,
  priceTicks,
  notionalCents: Math.round((shares * priceTicks) / 100),
  realizedCents,
  at: NOW,
});

const partialSell = makeOrder({
  side: 'sell',
  type: 'limit',
  status: 'partially_filled',
  limitTicks: 1_165_000,
  amountCents: null,
  qtyMicros: 15_000_000,
  filledMicros: 8_000_000,
  filledNotionalCents: 93_215,
  heldCents: 0,
  heldMicros: 7_000_000,
  fills: [fill('f1', 5, 1_165_000, -1_200), fill('f2', 3, 1_165_500, -705)],
});

describe('order labels', () => {
  it('names the type with its price and time in force, and the size', () => {
    expect(orderTypeLabel(partialSell, copy)).toBe('Limit $116.50 · Day');
    expect(orderTypeLabel(makeOrder(), copy)).toBe('Market');
    expect(orderSizeLabel(partialSell, copy)).toBe('15 sh');
    expect(orderSizeLabel(makeOrder(), copy)).toBe('$100.00');
  });

  it('lets only working orders be canceled', () => {
    expect(isCancellable(makeOrder({ status: 'queued' }))).toBe(true);
    expect(isCancellable(partialSell)).toBe(true);
    expect(isCancellable(makeOrder({ status: 'filled' }))).toBe(false);
    expect(cancelLabel(partialSell, copy)).toBe('Cancel remaining');
    expect(cancelLabel(makeOrder(), copy)).toBe('Cancel order');
  });
});

describe('orderNote', () => {
  it('says how far a resting limit is from the market when the last price is known', () => {
    const limit = makeOrder({ type: 'limit', limitTicks: 2_000_000, qtyMicros: 1_000_000 });

    expect(orderNote(limit, copy, 2_200_000)).toBe('Last $220.00 · 9.09% away');
    expect(orderNote(limit, copy)).toBe('Working · 1 remaining');
  });

  it('counts the dollars still working on an amount order', () => {
    expect(orderNote(makeOrder({ type: 'limit', limitTicks: null }), copy)).toBe(
      'Working · $100.00 remaining',
    );
  });

  it.each([
    ['user', 'Canceled by you'],
    ['admin_reset', 'Canceled · account reset'],
    ['symbol_disabled', 'Canceled · stock no longer trades'],
    [null, 'Canceled'],
  ] as const)('says who canceled the order (%s)', (cancelReason, text) => {
    const canceled = makeOrder({ status: 'canceled', cancelReason, closedAt: NOW });

    expect(orderNote(canceled, copy)).toBe(text);
    expect(orderTimeline(canceled, copy).at(-1)).toMatchObject({ title: text, state: 'failed' });
  });
});

describe('orderTimeline', () => {
  it('lists placed, accepted, each partial fill and the working remainder', () => {
    expect(orderTimeline(partialSell, copy).map((step) => [step.title, step.state])).toEqual([
      ['Order placed', 'done'],
      ['Accepted by exchange sim', 'done'],
      ['Partially filled · 5 @ $116.50', 'done'],
      ['Partially filled · 3 @ $116.55', 'done'],
      ['Working · 7 remaining', 'now'],
    ]);
  });

  it('shows the remaining amount and reserved cash for a dollar-amount buy', () => {
    const working = makeOrder({
      type: 'limit',
      status: 'partially_filled',
      limitTicks: 2_300_000,
      amountCents: 50_000,
      filledMicros: 869_565,
      filledNotionalCents: 20_000,
      heldCents: 30_000,
    });

    const [, accepted, last] = orderTimeline(working, copy);

    expect(accepted?.detail).toContain('reserved $300.00');
    expect(last?.title).toBe('Working · $300.00 remaining');
  });
});

describe('fill summary', () => {
  it('reports progress by shares and the realized P&L of a sell', () => {
    expect(fillProgress(partialSell, copy)).toMatchObject({
      text: 'Filled 8 / 15',
      a11y: 'Filled 8 of 15',
    });
    expect(orderRealized(partialSell, copy)).toEqual({
      label: 'Realized P&L',
      value: '−$19.05',
      direction: 'down',
    });
  });

  it('has no progress for a rejected order and no realized P&L for a buy', () => {
    expect(fillProgress(makeOrder({ status: 'rejected' }), copy)).toBeNull();
    expect(orderRealized(makeOrder(), copy)).toBeNull();
  });
});
