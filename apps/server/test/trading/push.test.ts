import {
  ExpoPushSender,
  LogPushSender,
  pushMessage,
  pushSenderProvider,
} from '../../src/trading/push';

describe('push', () => {
  it('never reaches the network in tests', () => {
    expect(pushSenderProvider.useFactory()).toBeInstanceOf(LogPushSender);
  });

  it('greets a new account', () => {
    expect(pushMessage({ kind: 'welcome' })).toMatchObject({
      title: 'Your $100,000 practice account is ready',
      data: { kind: 'welcome' },
    });
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

  it('sends Expo pushes in chunks of 100, each with a 5 s timeout', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 200 }));
    const timeout = jest.spyOn(AbortSignal, 'timeout');
    const targets = Array.from({ length: 250 }, (_, i) => ({
      token: `ExponentPushToken[${i}]`,
      platform: 'ios',
    }));

    await new ExpoPushSender().send(targets, { title: 't', body: 'b', data: {} });

    const sizes = fetchMock.mock.calls.map(
      ([, init]) => (JSON.parse(init?.body as string) as unknown[]).length,
    );
    expect(sizes).toEqual([100, 100, 50]);
    expect(fetchMock.mock.calls.every(([, init]) => init?.signal instanceof AbortSignal)).toBe(
      true,
    );
    expect(timeout).toHaveBeenCalledWith(5_000);
  });
});
