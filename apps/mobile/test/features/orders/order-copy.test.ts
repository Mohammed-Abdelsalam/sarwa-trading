import { describeOrder } from '../../../src/features/orders/order-copy';
import { orderTimeline } from '../../../src/features/orders/order-timeline';
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

describe('orderTimeline', () => {
  it('lists placed, accepted, each partial fill and the working remainder', async () => {
    const copy = await englishCopy();
    const partial = order({
      side: 'sell',
      type: 'limit',
      status: 'partially_filled',
      limitTicks: 1_165_000,
      amountCents: null,
      qtyMicros: 15_000_000,
      filledMicros: 8_000_000,
      heldMicros: 7_000_000,
      fills: [
        {
          id: 'f1',
          qtyMicros: 5_000_000,
          priceTicks: 1_165_000,
          notionalCents: 58_250,
          realizedCents: -1_200,
          at: NOW,
        },
        {
          id: 'f2',
          qtyMicros: 3_000_000,
          priceTicks: 1_165_500,
          notionalCents: 34_965,
          realizedCents: -705,
          at: NOW,
        },
      ],
    });

    expect(orderTimeline(partial, copy).map((step) => [step.title, step.state])).toEqual([
      ['Order placed', 'done'],
      ['Accepted by exchange sim', 'done'],
      ['Partially filled · 5 @ $116.50', 'done'],
      ['Partially filled · 3 @ $116.55', 'done'],
      ['Working · 7 remaining', 'now'],
    ]);
  });

  it('shows the remaining amount and reserved cash for a dollar-amount buy', async () => {
    const copy = await englishCopy();
    const working = order({
      type: 'limit',
      status: 'partially_filled',
      limitTicks: 2_300_000,
      filledMicros: 869_565,
      filledNotionalCents: 20_000,
      heldCents: 30_000,
    });

    const [, accepted, last] = orderTimeline(working, copy);

    expect(accepted?.detail).toContain('reserved $300.00');
    expect(last?.title).toBe('Working · $300.00 remaining');
  });
});
