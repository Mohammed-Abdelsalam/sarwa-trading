import { bps, cents, ticks } from '@sarwa/core';

import { blockLabel } from '../../../src/features/order-ticket/ticket-entry-model';
import { resultRows } from '../../../src/features/order-ticket/ticket-review-model';
import { order } from '../../fixtures';
import { englishCopy } from '../../render';

describe('order ticket model', () => {
  it('labels the button Loading… until the trading status arrives', async () => {
    const copy = await englishCopy();

    expect(blockLabel({ code: 'STATUS_LOADING' }, 'AAPL', copy)).toBe('Loading…');
  });

  it('shows the fill slippage in dollars per share, as in the design', async () => {
    const copy = await englishCopy();
    const rows = resultRows(
      order({ id: 'ord-1' }),
      { avgFillTicks: ticks(2_315_200), slippageBps: bps(1), slippageCents: cents(2) },
      copy,
    );

    expect(rows.find((row) => row.key === 'slip')?.value).toBe('+$0.02 slippage');
    expect(rows.find((row) => row.key === 'id')?.value).toBe('ord-1');
  });
});
