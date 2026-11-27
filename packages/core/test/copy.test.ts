import { type TradingStatus } from '@sarwa/contracts';
import { createFormatter, getMessages, type Locale, rejectionMessage } from '@sarwa/i18n';

import {
  alertRuleText,
  digitOptions,
  languageOptions,
  marketPill,
  notificationText,
} from '../src/copy';
import { type I18n } from '../src/hooks/i18n';

function copy(locale: Locale = 'en') {
  return {
    locale,
    t: getMessages(locale),
    f: createFormatter({ locale }),
    rejection: (rejection: Parameters<I18n['rejection']>[0], symbol: string) =>
      rejectionMessage(rejection as Parameters<typeof rejectionMessage>[0], locale, 'latn', {
        symbol,
      }),
  };
}

const order = { orderId: 'o1', symbol: 'AAPL', side: 'buy' as const, priceTicks: 2_315_000 };

describe('notificationText', () => {
  it('says what a fill bought and for how much', () => {
    expect(
      notificationText(
        { kind: 'order_filled', ...order, qtyMicros: 2_159_827, notionalCents: 50_000 },
        copy(),
      ),
    ).toEqual({ title: 'Order filled', body: 'Bought 2.159827 AAPL for $500.00' });
  });

  it('titles a partial fill and a sell', () => {
    expect(
      notificationText(
        {
          kind: 'order_partially_filled',
          ...order,
          side: 'sell',
          qtyMicros: 1_000_000,
          notionalCents: 23_150,
        },
        copy(),
      ),
    ).toEqual({ title: 'Order partially filled', body: 'Sold 1 AAPL for $231.50' });
  });

  it('names canceled and expired orders by side and symbol', () => {
    const closed = { ...order, qtyMicros: 0, notionalCents: 0 };

    expect(notificationText({ kind: 'order_canceled', ...closed }, copy()).body).toBe(
      'Buy AAPL was canceled.',
    );
    expect(notificationText({ kind: 'order_expired', ...closed }, copy()).title).toBe(
      'Order expired',
    );
  });

  it('gives the rejection reason', () => {
    expect(
      notificationText(
        { kind: 'order_rejected', ...order, rejection: { code: 'MARKET_CLOSED' } },
        copy(),
      ).body,
    ).toBe('Buy AAPL — Market closed.');
  });

  it('renders alerts, halts and market notices', () => {
    expect(
      notificationText(
        {
          kind: 'alert_triggered',
          alertId: 'a1',
          symbol: 'AAPL',
          condition: 'price_above',
          thresholdTicks: 2_300_000,
          thresholdBps: null,
          lastTicks: 2_314_800,
        },
        copy(),
      ),
    ).toEqual({
      title: 'AAPL crossed $230.00',
      body: 'Your alert “Price above $230.00” triggered at $231.48.',
    });
    expect(
      notificationText(
        { kind: 'symbol_halted', symbol: 'TSLA', message: 'News pending', resumesAt: null },
        copy('ar'),
      ).title,
    ).toBe('تم إيقاف TSLA');
    expect(notificationText({ kind: 'market_notice', message: 'Hi' }, copy())).toEqual({
      title: 'Market notice',
      body: 'Hi',
    });
  });
});

describe('alertRuleText', () => {
  it('describes a percent move with its sign', () => {
    expect(
      alertRuleText({ condition: 'move_today', thresholdTicks: null, thresholdBps: -500 }, copy()),
    ).toBe('Day change ≤ −5.00%');
  });
});

describe('marketPill', () => {
  const session = {
    phase: 'regular',
    isOpen: true,
    opensAt: Date.UTC(2026, 10, 27, 14, 30),
    closesAt: Date.UTC(2026, 10, 27, 18, 0),
    earlyClose: true,
  } as TradingStatus['session'];

  it('lets a dropped connection win over the session', () => {
    expect(marketPill('reconnecting', session, copy())).toMatchObject({
      state: 'reconnecting',
      label: 'Reconnecting…',
    });
    expect(marketPill('paused', session, copy()).state).toBe('halted');
    expect(marketPill('offline', session, copy()).label).toBe('Offline');
  });

  it('shows the session with a short form', () => {
    expect(marketPill('live', session, copy())).toEqual({
      state: 'open',
      label: 'Early close · 1:00 PM ET',
      short: 'Live',
    });
    expect(marketPill('live', { ...session, phase: 'post', isOpen: false }, copy())).toEqual({
      state: 'post',
      label: 'After hours',
      short: 'After hours',
    });
  });
});

describe('option labels', () => {
  it('shows each digit style in its own digits', () => {
    expect(digitOptions(copy()).map((option) => option.label)).toEqual([
      'Western · 123',
      'Arabic-Indic · ١٢٣',
    ]);
    expect(languageOptions(copy()).map((option) => option.value)).toEqual(['en', 'ar']);
  });
});
