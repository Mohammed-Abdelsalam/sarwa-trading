import {
  type Bps,
  type Cents,
  divide,
  MICROS_PER_SHARE,
  type Micros,
  notionalCents,
  ratioBps,
  type Ticks,
  TICKS_PER_DOLLAR,
  CENTS_PER_DOLLAR,
} from './money';
import { type Side } from './orders';

// Cost basis is stored as a total, not as avg × qty, so selling part of a position can never drift
// the books by a cent: average cost is derived from it.
export interface Position {
  symbol: string;
  qtyMicros: Micros;
  costBasisCents: Cents;
}

export interface Hold {
  side: Side;
  symbol: string;
  heldCents: Cents;
  heldMicros: Micros;
}

export function averageCostTicks(position: Pick<Position, 'qtyMicros' | 'costBasisCents'>): Ticks {
  if (position.qtyMicros === 0) return 0;
  const ticksPerCent = BigInt(TICKS_PER_DOLLAR / CENTS_PER_DOLLAR);
  return divide(
    BigInt(position.costBasisCents) * ticksPerCent * BigInt(MICROS_PER_SHARE),
    BigInt(position.qtyMicros),
    'nearest',
  );
}

export function marketValueCents(qty: Micros, lastTicks: Ticks): Cents {
  return notionalCents(qty, lastTicks, 'nearest');
}

export function reservedCents(holds: readonly Hold[]): Cents {
  return holds.filter((hold) => hold.side === 'buy').reduce((sum, hold) => sum + hold.heldCents, 0);
}

// Cash itself never moves when an order is placed; open buys only earmark part of it.
export function buyingPowerCents(cashCents: Cents, holds: readonly Hold[]): Cents {
  return cashCents - reservedCents(holds);
}

export function sellableMicros(position: Position | null, holds: readonly Hold[]): Micros {
  if (!position) return 0;
  const reserved = holds
    .filter((hold) => hold.side === 'sell' && hold.symbol === position.symbol)
    .reduce((sum, hold) => sum + hold.heldMicros, 0);
  return Math.max(0, position.qtyMicros - reserved);
}

export interface PositionInput {
  position: Position;
  sector: string;
  lastTicks: Ticks;
  prevCloseTicks: Ticks;
  // Shares held at the last close and today's flows; omitted when nothing traded today.
  today?: { qtyAtOpenMicros: Micros; boughtCents: Cents; soldCents: Cents };
}

export interface PortfolioInput {
  cashCents: Cents;
  startingCashCents: Cents;
  holds: readonly Hold[];
  positions: readonly PositionInput[];
  realizedYtdCents: Cents;
  // Equity at the previous close; null for an account opened today.
  equityAtLastCloseCents: Cents | null;
}

export interface PositionSummary {
  symbol: string;
  sector: string;
  qtyMicros: Micros;
  averageCostTicks: Ticks;
  lastTicks: Ticks;
  marketValueCents: Cents;
  unrealizedCents: Cents;
  totalReturnBps: Bps;
  todayCents: Cents;
  weightBps: Bps;
}

export interface AllocationSlice {
  key: string;
  cents: Cents;
  weightBps: Bps;
}

export interface PortfolioSummary {
  equityCents: Cents;
  cashCents: Cents;
  reservedCents: Cents;
  buyingPowerCents: Cents;
  investedCents: Cents;
  unrealizedCents: Cents;
  realizedYtdCents: Cents;
  todayCents: Cents;
  todayBps: Bps;
  allTimeCents: Cents;
  allTimeBps: Bps;
  positions: PositionSummary[];
  allocation: AllocationSlice[];
}

// A position opened today has no prior close to compare to: its "today" is measured against what
// was actually paid (and received) today, on top of the shares carried from yesterday.
function positionToday(input: PositionInput, marketValue: Cents): Cents {
  const today = input.today ?? {
    qtyAtOpenMicros: input.position.qtyMicros,
    boughtCents: 0,
    soldCents: 0,
  };
  const carried = marketValueCents(today.qtyAtOpenMicros, input.prevCloseTicks);
  return marketValue - (carried + today.boughtCents - today.soldCents);
}

export function summarizePortfolio(input: PortfolioInput): PortfolioSummary {
  const rows = input.positions.map((p) => {
    const marketValue = marketValueCents(p.position.qtyMicros, p.lastTicks);
    return {
      symbol: p.position.symbol,
      sector: p.sector,
      qtyMicros: p.position.qtyMicros,
      averageCostTicks: averageCostTicks(p.position),
      lastTicks: p.lastTicks,
      marketValueCents: marketValue,
      unrealizedCents: marketValue - p.position.costBasisCents,
      totalReturnBps: ratioBps(marketValue - p.position.costBasisCents, p.position.costBasisCents),
      todayCents: positionToday(p, marketValue),
    };
  });
  const investedCents = rows.reduce((sum, row) => sum + row.marketValueCents, 0);
  const equityCents = input.cashCents + investedCents;
  const reserved = reservedCents(input.holds);
  const positionsToday = rows.reduce((sum, row) => sum + row.todayCents, 0);
  const todayCents =
    input.equityAtLastCloseCents === null
      ? positionsToday
      : equityCents - input.equityAtLastCloseCents;
  const todayBase = input.equityAtLastCloseCents ?? equityCents - todayCents;

  const bySector = new Map<string, Cents>();
  for (const row of rows)
    bySector.set(row.sector, (bySector.get(row.sector) ?? 0) + row.marketValueCents);
  const allocation = [...bySector, ['cash', input.cashCents] as const]
    .map(([key, cents]) => ({ key, cents, weightBps: ratioBps(cents, equityCents) }))
    .filter((slice) => slice.cents > 0)
    .sort((a, b) => b.cents - a.cents);

  return {
    equityCents,
    cashCents: input.cashCents,
    reservedCents: reserved,
    buyingPowerCents: input.cashCents - reserved,
    investedCents,
    unrealizedCents: rows.reduce((sum, row) => sum + row.unrealizedCents, 0),
    realizedYtdCents: input.realizedYtdCents,
    todayCents,
    todayBps: ratioBps(todayCents, todayBase),
    allTimeCents: equityCents - input.startingCashCents,
    allTimeBps: ratioBps(equityCents - input.startingCashCents, input.startingCashCents),
    positions: rows
      .map((row) => ({ ...row, weightBps: ratioBps(row.marketValueCents, equityCents) }))
      .sort((a, b) => b.marketValueCents - a.marketValueCents),
    allocation,
  };
}
