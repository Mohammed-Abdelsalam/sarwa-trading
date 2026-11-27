import { groupNotifications } from '../../../src/features/notifications/notification-copy';
import { notification } from '../../fixtures';
import { englishCopy } from '../../render';

const NOW = new Date(2026, 10, 27, 15, 0).getTime();
const TODAY = NOW - 2 * 60_000;
const YESTERDAY = NOW - 26 * 60 * 60_000;

describe('groupNotifications', () => {
  it('splits Today from Earlier and renders each payload kind with shared copy', async () => {
    const copy = await englishCopy();
    const groups = groupNotifications(
      [
        notification(
          {
            kind: 'order_filled',
            orderId: 'o_1',
            symbol: 'AAPL',
            side: 'buy',
            qtyMicros: 2_159_827,
            priceTicks: 2_315_000,
            notionalCents: 50_000,
          },
          TODAY,
        ),
        notification(
          {
            kind: 'alert_triggered',
            alertId: 'a_1',
            symbol: 'JPM',
            condition: 'price_above',
            thresholdTicks: 2_400_000,
            thresholdBps: null,
            lastTicks: 2_400_600,
          },
          TODAY,
        ),
        notification(
          {
            kind: 'order_rejected',
            orderId: 'o_2',
            symbol: 'META',
            side: 'buy',
            rejection: { code: 'MARKET_CLOSED' },
          },
          YESTERDAY,
          true,
        ),
      ],
      copy,
      NOW,
    );

    expect(groups.map((g) => g.title)).toEqual(['Today', 'Earlier']);
    const [filled, alert] = groups[0]?.items ?? [];
    expect(filled).toMatchObject({
      title: 'Order filled',
      body: 'Bought 2.159827 AAPL for $500.00',
      kind: 'filled',
      href: { pathname: '/orders/[id]', params: { id: 'o_1' } },
      unread: true,
    });
    expect(filled?.when).toBe('2 min ago');
    expect(alert).toMatchObject({
      title: 'JPM crossed $240.00',
      body: 'Your alert “Price above $240.00” triggered at $240.06.',
      href: { pathname: '/alerts' },
    });
    expect(groups[1]?.items[0]).toMatchObject({
      title: 'Order rejected',
      body: 'Buy META — Market closed.',
      unread: false,
    });
  });

  it('names canceled orders and market notices', async () => {
    const copy = await englishCopy();
    const [group] = groupNotifications(
      [
        notification(
          {
            kind: 'order_canceled',
            orderId: 'o_3',
            symbol: 'KO',
            side: 'sell',
            qtyMicros: 0,
            priceTicks: null,
            notionalCents: 0,
          },
          TODAY,
        ),
        notification({ kind: 'market_notice', message: 'Early close today' }, TODAY),
      ],
      copy,
      NOW,
    );

    expect(group?.items).toMatchObject([
      { kind: 'expired', title: 'Order canceled', body: 'Sell KO was canceled.' },
      { kind: 'notice', title: 'Market notice', body: 'Early close today', href: null },
    ]);
  });

  it('drops empty groups', async () => {
    const copy = await englishCopy();
    expect(groupNotifications([], copy, NOW)).toEqual([]);
  });
});
