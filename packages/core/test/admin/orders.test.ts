import { createFormatter, getMessages } from '@sarwa/i18n';

import { stockErrorText } from '../../src/admin/forms';
import { orderNotionalCents, orderStatsBreakdown } from '../../src/admin/orders';
import { makeAdminOrder } from './fixtures';

describe('orderNotionalCents', () => {
  it('uses the dollar amount, then what filled, then qty at the quoted price', () => {
    expect(orderNotionalCents(makeAdminOrder({ amountCents: 50_000 }))).toBe(50_000);
    expect(
      orderNotionalCents(makeAdminOrder({ amountCents: null, filledNotionalCents: 12_345 })),
    ).toBe(12_345);
    expect(
      orderNotionalCents(
        makeAdminOrder({
          amountCents: null,
          filledNotionalCents: 0,
          qtyMicros: 2_000_000,
          limitTicks: null,
          quotedTicks: 1_000_000,
        }),
      ),
    ).toBe(20_000);
  });
});

describe('orderStatsBreakdown', () => {
  it('sorts rejections and gives each row its share and bar length', () => {
    const view = orderStatsBreakdown({
      ordersToday: 10,
      fillRateBps: 0,
      rejectedBps: 0,
      notionalTodayCents: 0,
      activeTraders: 1,
      rejectionsByReason: [
        { code: 'MARKET_CLOSED', count: 1 },
        { code: 'INSUFFICIENT_FUNDS', count: 3 },
      ],
      typeMix: [
        { type: 'market', count: 3 },
        { type: 'limit', count: 1 },
      ],
      amountOrders: 4,
    });

    expect(view.rejections.map((row) => [row.code, row.shareBps, row.weight])).toEqual([
      ['INSUFFICIENT_FUNDS', 7_500, 1],
      ['MARKET_CLOSED', 2_500, 1 / 3],
    ]);
    expect(view.typeMix[0]).toMatchObject({ shareBps: 7_500, weight: 0.75 });
    expect(view.fractionalBps).toBe(4_000);
  });

  it('is empty before the stats load', () => {
    expect(orderStatsBreakdown(undefined)).toEqual({
      rejections: [],
      typeMix: [],
      fractionalBps: 0,
    });
  });
});

describe('stockErrorText', () => {
  const copy = { t: getMessages('en'), f: createFormatter({ locale: 'en' }) };

  it('fills the limits into the field error copy', () => {
    expect(stockErrorText('symbolFormat', copy)).toBe('1–10 uppercase letters, e.g. AAPL');
    expect(stockErrorText('range', copy)).toBe('0.1× – 5.0×');
    expect(stockErrorText('required', copy)).toBe('Required');
  });
});
