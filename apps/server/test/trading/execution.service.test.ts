import { type Order as OrderRow } from '@prisma/client';

import {
  bps,
  DEFAULT_EXECUTION_RULES,
  micros,
  MICROS_PER_SHARE,
  spreadAround,
  ticks,
} from '@sarwa/domain';

import { Clock } from '../../src/common/clock';
import { ExecutionService } from '../../src/trading/execution.service';

const T0 = Date.UTC(2026, 11, 1, 15, 0);

function service() {
  const prisma = { $transaction: jest.fn().mockResolvedValue(null), order: { update: jest.fn() } };
  const config = { get: () => ({ rules: DEFAULT_EXECUTION_RULES }) };
  const execution = new ExecutionService(
    prisma as never,
    new Clock(),
    config as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  execution.random = () => 0;
  return { execution, prisma };
}

const limitBuy = {
  id: 'order-1',
  side: 'buy',
  type: 'limit',
  status: 'open',
  qtyMicros: 10n * BigInt(MICROS_PER_SHARE),
  amountCents: null,
  limitTicks: 1_010_000n,
  stopTicks: null,
  filledMicros: 0n,
  filledNotionalCents: 0n,
  filledExactNotional: '0',
  heldCents: 101_000n,
  heldMicros: 0n,
  holdPriceTicks: 1_010_000n,
  holdBudgetCents: 101_000n,
  triggeredAt: null,
} as unknown as OrderRow;

const LAST = ticks(1_000_000);
const quote = (size: number) => ({
  lastTicks: LAST,
  ...spreadAround(LAST, bps(2)),
  prevCloseTicks: LAST,
  bidSizeMicros: micros(size),
  askSizeMicros: micros(size),
  ts: T0,
});

describe('ExecutionService.work', () => {
  it('skips the fill when the displayed size is 0', async () => {
    const { execution, prisma } = service();

    await execution.work(limitBuy, quote(0));

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('fills a marketable limit when size is displayed', async () => {
    const { execution, prisma } = service();

    await execution.work(limitBuy, quote(MICROS_PER_SHARE));

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
