import { LogPushSender, pushMessage, pushSenderProvider } from '../../src/trading/push';

describe('push', () => {
  it('never reaches the network in tests', () => {
    expect(pushSenderProvider.useFactory()).toBeInstanceOf(LogPushSender);
  });

  it('writes lock-screen text from a notification payload', () => {
    const message = pushMessage({
      kind: 'order_filled',
      orderId: 'o1',
      symbol: 'AAPL',
      side: 'buy',
      qtyMicros: 2_500_000,
      priceTicks: 2_314_800,
      notionalCents: 57_870,
    });

    expect(message).toMatchObject({
      title: 'AAPL buy filled',
      body: '2.5 shares for $578.70',
      data: { orderId: 'o1' },
    });
  });
});
