import { describeOrder } from '../../../src/features/orders/order-copy';
import { order } from '../../fixtures';
import { englishCopy } from '../../render';

const NOW = Date.UTC(2026, 10, 27, 20, 0);

describe('describeOrder', () => {
  it('describes a filled dollar-amount market buy', async () => {
    const copy = await englishCopy();
    const line = describeOrder(order(), copy, NOW);

    expect(line.typeLine).toBe('Market');
    expect(line.amount).toBe('$500.00');
    expect(line.note).toBe('Filled @ $231.52');
    expect(line.a11yLabel).toContain('Buy, AAPL, $500.00');
  });

  it('describes a working stop and a limit with its time in force', async () => {
    const copy = await englishCopy();
    const stop = order({
      type: 'stop',
      status: 'open',
      stopTicks: 1_600_000,
      amountCents: null,
      qtyMicros: 20_000_000,
    });
    const limit = order({ type: 'limit', tif: 'gtc', status: 'open', limitTicks: 2_550_000 });

    expect(describeOrder(stop, copy, NOW).note).toBe('Triggers if ≥ $160.00');
    expect(describeOrder(stop, copy, NOW).amount).toBe('20 sh');
    expect(describeOrder(limit, copy, NOW).typeLine).toBe('Limit $255.00 · GTC');
  });

  it('gives the rejection reason through the shared catalog', async () => {
    const copy = await englishCopy();
    const rejected = order({
      status: 'rejected',
      rejection: {
        code: 'INSUFFICIENT_FUNDS',
        field: 'size',
        requiredCents: 5_846_000,
        availableCents: 100,
      },
    });

    expect(describeOrder(rejected, copy, NOW).note).toBe('Insufficient buying power');
  });
});

describe('canceled orders', () => {
  it.each([
    ['user', 'Canceled by you'],
    ['admin_reset', 'Canceled · account reset'],
    ['symbol_disabled', 'Canceled · stock no longer trades'],
  ] as const)('says who canceled it (%s)', async (cancelReason, text) => {
    const copy = await englishCopy();
    const canceled = order({ status: 'canceled', cancelReason, closedAt: NOW });

    expect(describeOrder(canceled, copy, NOW).note).toBe(text);
  });
});
