import {
  ALERT_CONDITIONS,
  AUTH_FIELD_ERRORS,
  CANCEL_REASONS,
  cents,
  ORDER_STATUSES,
  PASSWORD_POLICY,
  SESSION_MODES,
  SESSION_PHASES,
  SIDES,
  SUSPENSION_CATEGORIES,
} from '@sarwa/domain';

import { createFormatter, getAdminMessages, getMessages } from '../src';

const en = getMessages('en');
const ar = getMessages('ar');
const adminEn = getAdminMessages('en');
const adminAr = getAdminMessages('ar');

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
    expect(shape(adminAr)).toEqual(shape(adminEn));
  });

  it.each([
    ['en', en],
    ['ar', ar],
    ['admin en', adminEn],
    ['admin ar', adminAr],
  ] as [string, object][])(
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
    }
    for (const admin of [adminEn, adminAr]) {
      for (const mode of SESSION_MODES) expect(admin.trading.sessionModes[mode]).toBeTruthy();
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
    ['admin en', 1, adminEn],
    ['admin en', 2, adminEn],
    ['admin ar', 2, adminAr],
    ['admin ar', 11, adminAr],
  ] as [string, number, object][])(
    'renders %s copy with all its params when count is %i',
    (_, count, messages) => {
      const rendered = render(messages, count);

      expect(rendered.length).toBeGreaterThan(50);
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
    expect(adminEn.tripsToday(enF.count(1))).toBe('1 trip today');
    expect(adminEn.tripsToday(enF.count(3))).toBe('3 trips today');
    expect(en.portfolio.openOrdersLink(enF.count(2))).toBe('2 open orders · View');
    expect(adminEn.haltOpenOrders({ ...enF.count(1), symbol: 'NVDA' })).toContain(
      '1 open NVDA order will pause.',
    );
  });

  it('keeps the typed confirmation word inside one sentence per language', () => {
    expect(adminEn.market.dropConfirmLabel({ word: 'DROP' })).toBe('Type DROP to confirm');
    expect(adminAr.market.dropConfirmLabel({ word: 'DROP' })).toBe('اكتب DROP للتأكيد');
  });

  it('uses the Arabic dual and few forms', () => {
    expect(adminAr.tripsToday(arF.count(2))).toBe('تفعيلان اليوم');
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

describe('account copy', () => {
  it('words every auth field error and cancel reason in both languages', () => {
    for (const messages of [en, ar]) {
      for (const code of AUTH_FIELD_ERRORS)
        expect(messages.auth.fieldErrors[code]({ n: '8' })).toBeTruthy();
      for (const reason of CANCEL_REASONS) expect(messages.orders.canceledBy[reason]).toBeTruthy();
    }
  });

  it('fills the password limit into the field error', () => {
    const n = String(PASSWORD_POLICY.minLength);
    expect(en.auth.fieldErrors.PASSWORD_TOO_SHORT({ n })).toBe('Use at least 8 characters');
    expect(ar.auth.fieldErrors.PASSWORD_TOO_SHORT({ n })).toBe('استخدم 8 أحرف على الأقل');
  });

  it('pluralises the counts the account dialogs are built from', () => {
    expect(en.counts.positions({ count: 1, n: '1' })).toBe('1 position');
    expect(en.counts.openOrders({ count: 2, n: '2' })).toBe('2 open orders');
    expect(ar.counts.devices({ count: 2, n: '2' })).toBe('جهازان');
    expect(ar.counts.sessions({ count: 3, n: '3' })).toBe('3 جلسات');
  });

  it('composes the guest-data warning from those counts', () => {
    const positions = en.counts.positions({ count: 3, n: '3' });
    const orders = en.counts.openOrders({ count: 1, n: '1' });
    expect(en.discard.body({ positions, orders })).toBe(
      '3 positions and 1 open order on this device will be discarded and your account’s portfolio loaded. They are never merged.',
    );
  });

  it('labels every suspension category for admins and customers', () => {
    for (const admin of [adminEn, adminAr]) {
      for (const category of SUSPENSION_CATEGORIES)
        expect(admin.customers.reasonCategories[category]).toBeTruthy();
    }
    for (const messages of [en, ar]) {
      for (const category of SUSPENSION_CATEGORIES)
        expect(messages.suspended.reasonCategories[category]).toBeTruthy();
    }
  });

  it('splits each terms sentence into link pieces that rebuild the whole sentence', () => {
    const join = ({ prefix, termsLink, and, privacyLink, suffix }: typeof en.auth.terms.page) =>
      prefix + termsLink + and + privacyLink + suffix;

    for (const messages of [en, ar]) {
      expect(join(messages.auth.terms.page)).toBe(messages.auth.signUp.terms);
      expect(join(messages.auth.terms.modal)).toBe(messages.auth.signUp.termsModal);
    }
    expect(join(en.auth.terms.mobile)).toBe(
      'I agree to the Terms and Privacy Policy and understand money is virtual.',
    );
  });

  it('gives a detailed revoke message for every plain one except suspension', () => {
    const params = { device: 'iPhone 15', time: '5 min ago' };
    for (const messages of [en, ar]) {
      const plain = Object.keys(messages.revoked.reasons).filter((key) => key !== 'suspended');
      expect(Object.keys(messages.revoked.reasonsDetailed).sort()).toEqual(plain.sort());
    }
    expect(en.revoked.reasonsDetailed.signed_out(params)).toBe(
      'This session was ended from iPhone 15 5 min ago. Sign in again to continue.',
    );
    expect(ar.revoked.reasonsDetailed.revoked({ ...params, time: 'منذ ٥ دقائق' })).toBe(
      'تم تسجيل خروج هذا الجهاز من iPhone 15 منذ ٥ دقائق.',
    );
  });

  it('pluralises hours like the other counts', () => {
    expect(en.common.hours({ count: 1, n: '1' })).toBe('1 hour');
    expect(en.common.hours({ count: 3, n: '3' })).toBe('3 hours');
    expect(ar.common.hours({ count: 2, n: '٢' })).toBe('ساعتين');
    expect(ar.counts.hours({ count: 5, n: '٥' })).toBe('٥ ساعات');
  });

  it('fills the short guest step and the admin invite label', () => {
    expect(en.home.guest.stepsShort.getCash({ amount: '$10,000' })).toBe('Get $10,000');
    expect(adminEn.team.revokeInvite({ email: 'a@b.dev' })).toBe('Revoke the invite for a@b.dev');
    expect(adminEn.states.requestId({ id: 'req-42' })).toBe('Request ID req-42');
    expect(adminAr.states.requestId({ id: 'req-42' })).toBe('معرّف الطلب req-42');
    expect(adminAr.team.revokeInvite({ email: 'a@b.dev' })).toBe('إلغاء دعوة a@b.dev');
    expect(adminEn.team.resendInvite({ email: 'a@b.dev' })).toBe('Resend the invite to a@b.dev');
  });
});
