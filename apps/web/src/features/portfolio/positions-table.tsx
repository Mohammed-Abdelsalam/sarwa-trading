import { type Route } from 'next';
import Link from 'next/link';

import {
  Button,
  ChangePill,
  cn,
  type SortDirection,
  SortHeader,
  StockAvatar,
  Table,
  TBody,
  TCell,
  TH,
  THead,
  TRow,
} from '@sarwa/ui';

import { type PositionRow, type PositionSortKey } from './use-portfolio-page';

const TONE = { up: 'text-pos', down: 'text-neg', flat: 'text-fg-2' } as const;
const PILL_VALUE = { up: 1, down: -1, flat: 0 } as const;
// Below 768 px only what fits a phone stays: the stock, its value, the return and the actions.
const SECONDARY = 'max-md:hidden';

export function PositionsTable({
  rows,
  columns,
  buyLabel,
  sellLabel,
  sortDirection,
  onSort,
  onBuy,
  onSell,
}: {
  rows: readonly PositionRow[];
  columns: Record<
    | 'position'
    | 'shares'
    | 'avgCost'
    | 'last'
    | 'marketValue'
    | 'today'
    | 'totalReturn'
    | 'weight'
    | 'actions',
    string
  >;
  buyLabel: string;
  sellLabel: string;
  sortDirection: (key: PositionSortKey) => SortDirection;
  onSort: (key: PositionSortKey) => void;
  onBuy: (symbol: string) => void;
  onSell: (symbol: string) => void;
}) {
  const header = (
    key: PositionSortKey,
    label: string,
    { align = 'end', className }: { align?: 'start' | 'end'; className?: string } = {},
  ) => (
    <SortHeader
      label={label}
      direction={sortDirection(key)}
      align={align}
      className={className}
      onSort={() => {
        onSort(key);
      }}
    />
  );

  return (
    <div className="relative overflow-x-auto">
      <Table>
        <THead>
          <tr>
            {header('symbol', columns.position, { align: 'start' })}
            {header('qtyMicros', columns.shares, { className: SECONDARY })}
            {header('averageCostTicks', columns.avgCost, { className: SECONDARY })}
            {header('lastTicks', columns.last, { className: SECONDARY })}
            {header('marketValueCents', columns.marketValue)}
            {header('todayCents', columns.today, { className: SECONDARY })}
            {header('totalReturnBps', columns.totalReturn)}
            {header('weightBps', columns.weight, { className: SECONDARY })}
            <TH align="end">
              <span className="sr-only">{columns.actions}</span>
            </TH>
          </tr>
        </THead>
        <TBody>
          {rows.map((row) => (
            <TRow key={row.symbol}>
              <TCell className="ps-4.5">
                <Link
                  href={`/stocks/${row.symbol}` as Route}
                  className="focus-visible:outline-focus flex items-center gap-2.5 rounded-xs focus-visible:outline-2"
                >
                  <StockAvatar symbol={row.symbol} sector={row.sector} size={32} />
                  <span>
                    <b className="block">{row.symbol}</b>
                    <span className="type-caption text-fg-3 block">{row.name}</span>
                  </span>
                </Link>
              </TCell>
              <TCell align="end" className={SECONDARY}>
                {row.shares}
              </TCell>
              <TCell align="end" className={cn('text-fg-2', SECONDARY)}>
                {row.avgCost}
              </TCell>
              <TCell align="end" className={SECONDARY}>
                {row.last}
              </TCell>
              <TCell align="end" className="font-semibold">
                {row.marketValue}
              </TCell>
              <TCell
                align="end"
                className={cn('font-semibold', TONE[row.todayDirection], SECONDARY)}
              >
                {row.today}
              </TCell>
              <TCell align="end">
                <ChangePill
                  value={PILL_VALUE[row.totalDirection]}
                  label={`${row.total} · ${row.totalPct}`}
                  size="sm"
                />
              </TCell>
              <TCell align="end" className={cn('text-fg-2', SECONDARY)}>
                {row.weight}
              </TCell>
              <TCell align="end">
                <div className="inline-flex gap-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    aria-label={`${buyLabel} ${row.symbol}`}
                    onClick={() => {
                      onBuy(row.symbol);
                    }}
                  >
                    {buyLabel}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`${sellLabel} ${row.symbol}`}
                    onClick={() => {
                      onSell(row.symbol);
                    }}
                  >
                    {sellLabel}
                  </Button>
                </div>
              </TCell>
            </TRow>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
