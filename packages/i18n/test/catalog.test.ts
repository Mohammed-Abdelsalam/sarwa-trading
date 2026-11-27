import {
  ALERT_CONDITIONS,
  cents,
  ORDER_STATUSES,
  SESSION_MODES,
  SESSION_PHASES,
  SIDES,
} from '@sarwa/domain';

import { createFormatter, getMessages, type Messages } from '../src';

const en = getMessages('en');
const ar = getMessages('ar');

function shape(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) return typeof value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, shape(child)]));
}

function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (typeof value !== 'object' || value === null) return [];
  return Object.values(value).flatMap(strings);
}

describe('catalogs', () => {
  it('gives Arabic the same keys and value kinds as English', () => {
    expect(shape(ar)).toEqual(shape(en));
  });

  it.each([
    ['en', en],
    ['ar', ar],
  ] as [string, Messages][])(
    'hardcodes no digits in %s strings, so the digit setting holds',
    (_, messages) => {
      expect(strings(messages).filter((text) => /[0-9٠-٩]/.test(text))).toEqual([]);
    },
  );

  it('labels every order status plus the client sending state', () => {
    for (const status of [...ORDER_STATUSES, 'sending'] as const) {
      expect(en.orderStatus[status]).toBeTruthy();
      expect(ar.orderStatus[status]).toBeTruthy();
    }
  });

  it('labels every side, session phase and session mode', () => {
    for (const messages of [en, ar]) {
      for (const side of SIDES) expect(messages.common.sides[side]).toBeTruthy();
      for (const phase of SESSION_PHASES) expect(messages.market.phases[phase]).toBeTruthy();
      for (const mode of SESSION_MODES)
        expect(messages.admin.trading.sessionModes[mode]).toBeTruthy();
    }
  });

  it('labels every alert condition', () => {
    for (const condition of ALERT_CONDITIONS) {
      expect(ar.alerts.conditions[condition]).toBeTruthy();
    }
  });
});

// Answers any destructured param: `count` drives plural rules, every other key echoes its name.
const anyParams = (count: number) =>
  new Proxy({}, { get: (_, key) => (key === 'count' ? count : `‹${String(key)}›`) });

function render(value: unknown, count: number): string[] {
  if (typeof value === 'function')
    return strings((value as (p: object) => unknown)(anyParams(count)));
  if (typeof value !== 'object' || value === null) return [];
  return Object.values(value).flatMap((child) => render(child, count));
}

describe('every message function', () => {
  it.each([
    ['en', 1, en],
    ['en', 2, en],
    ['ar', 1, ar],
    ['ar', 2, ar],
    ['ar', 5, ar],
    ['ar', 11, ar],
  ] as [string, number, Messages][])(
    'renders %s copy with all its params when count is %i',
    (_, count, messages) => {
      const rendered = render(messages, count);

      expect(rendered.length).toBeGreaterThan(100);
      expect(rendered.filter((text) => !text || /undefined|\[object/.test(text))).toEqual([]);
    },
  );
});

describe('message functions', () => {
  const enF = createFormatter({ locale: 'en' });
  const arF = createFormatter({ locale: 'ar', digits: 'arab' });

  it('fills the market session pill with a formatted time', () => {
    const close = Date.UTC(2026, 10, 27, 18, 0);

    expect(en.market.open({ time: enF.time(close) })).toBe('Open · closes 1:00 PM ET');
    expect(ar.market.open({ time: arF.time(close) })).toBe('مفتوحة · تُغلق ١:٠٠ م ET');
  });

  it('builds the GTC label from the policy days', () => {
    expect(en.ticket.gtcLong(enF.count(90))).toBe('Good till canceled (GTC · 90 days)');
    expect(ar.ticket.gtcLong(arF.count(90))).toBe('ساري حتى الإلغاء (GTC · ٩٠ يومًا)');
  });

  it('pluralises English counts', () => {
    expect(en.admin.tripsToday(enF.count(1))).toBe('1 trip today');
    expect(en.admin.tripsToday(enF.count(3))).toBe('3 trips today');
    expect(en.portfolio.openOrdersLink(enF.count(2))).toBe('2 open orders · View');
    expect(en.admin.haltOpenOrders({ ...enF.count(1), symbol: 'NVDA' })).toContain(
      '1 open NVDA order will pause.',
    );
  });

  it('uses the Arabic dual and few forms', () => {
    expect(ar.admin.tripsToday(arF.count(2))).toBe('تفعيلان اليوم');
    expect(ar.common.minutes(arF.count(5))).toBe('٥ دقائق');
    expect(ar.ticket.quoteValid(arF.count(7))).toBe('السعر صالح لمدة ٧ ثوانٍ');
    expect(ar.orders.lastDays(arF.count(7))).toBe('آخر ٧ أيام');
    expect(ar.watchlist.count(arF.count(2))).toBe('سهمان');
    expect(ar.watchlist.count(arF.count(4))).toBe('٤ أسهم');
  });

  it('counts watchlist stocks in English', () => {
    expect(en.watchlist.count(enF.count(1))).toBe('1 stock');
    expect(en.watchlist.count(enF.count(12))).toBe('12 stocks');
  });

  it('puts the filled amount in fill notification bodies', () => {
    const fill = { shares: '2.159827', symbol: 'AAPL', amount: enF.money(cents(50_000)) };

    expect(en.notifications.boughtBody(fill)).toBe('Bought 2.159827 AAPL for $500.00');
    expect(en.notifications.soldBody(fill)).toBe('Sold 2.159827 AAPL for $500.00');
  });

  it('fills the digit samples from the formatter, so no digits are hardcoded', () => {
    const sample = createFormatter({ locale: 'ar', digits: 'arab' }).number(123);

    expect(ar.settings.digitOptions.arab({ sample })).toBe('هندية · ١٢٣');
  });

  it('keeps tickers and order ids in Latin inside Arabic copy', () => {
    expect(ar.orders.orderA11y({ id: 'o_8ef3' })).toBe('الأمر o_8ef3');
    expect(ar.market.halted({ symbol: 'TSLA' })).toBe('تداول TSLA موقوف.');
  });
});
