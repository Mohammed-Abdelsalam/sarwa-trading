import { createFormatter, getMessages, rejectionMessage } from '@sarwa/i18n';

import { type I18n } from '../src/hooks/i18n';
import { notificationRows, notificationTarget } from '../src/notifications';
import { makeNotification } from './trading-fixtures';

const copy = {
  t: getMessages('en'),
  f: createFormatter({ locale: 'en' }),
  rejection: (rejection: Parameters<I18n['rejection']>[0], symbol: string) =>
    rejectionMessage(rejection as Parameters<typeof rejectionMessage>[0], 'en', 'latn', { symbol }),
};
const NOW = new Date(2026, 10, 27, 15, 0).getTime();
const MINUTE = 60_000;

describe('notificationTarget', () => {
  it('leads to the order, the alerts, the halted stock, or nowhere for a notice', () => {
    expect(
      notificationTarget({
        kind: 'order_canceled',
        orderId: 'o1',
        symbol: 'AAPL',
        side: 'buy',
        qtyMicros: 0,
        priceTicks: null,
        notionalCents: 0,
      }),
    ).toEqual({ kind: 'order', orderId: 'o1' });
    expect(notificationTarget({ kind: 'market_notice', message: 'Hi' })).toBeNull();
  });
});

describe('notificationRows', () => {
  it('splits today from earlier and shows recent ones as relative time', () => {
    const rows = notificationRows(
      [
        makeNotification({ id: 'a', createdAt: NOW - 2 * MINUTE }),
        makeNotification({ id: 'b', createdAt: NOW - 3 * 60 * MINUTE, readAt: NOW }),
        makeNotification({ id: 'c', createdAt: NOW - 26 * 60 * MINUTE }),
      ],
      NOW,
      copy,
    );

    expect(rows.map((row) => [row.id, row.today, row.unread, row.kind])).toEqual([
      ['a', true, true, 'notice'],
      ['b', true, false, 'notice'],
      ['c', false, true, 'notice'],
    ]);
    expect(rows[0]?.when).toBe('2 min ago');
    expect(rows[1]?.when).toBe(copy.f.time(NOW - 3 * 60 * MINUTE));
  });
});
