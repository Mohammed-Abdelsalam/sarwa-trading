import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, Star } from 'lucide-react';
import { type Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { type StockWithQuote } from '@sarwa/contracts';
import {
  change,
  changePct,
  direction,
  formatChange,
  formatMarketCap,
  formatPct,
  formatPrice,
  rangePosition,
  type SortKey,
  type SortOption,
  useI18n,
  useQuote,
  watchLabel,
} from '@sarwa/core';
import {
  buttonVariants,
  ChangePill,
  cn,
  PriceFlash,
  Sparkline,
  StarButton,
  StockAvatar,
} from '@sarwa/ui';

const COLOR = { up: 'text-pos', down: 'text-neg', flat: 'text-flat' } as const;

function SortHeader({
  label,
  column,
  sort,
  onSort,
  align = 'start',
}: {
  label: string;
  column: SortKey;
  sort: SortOption | null;
  onSort: (key: SortKey) => void;
  align?: 'start' | 'end';
}) {
  const active = sort?.key === column;
  const Icon = !active ? ArrowUpDown : sort.dir > 0 ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.dir > 0 ? 'ascending' : 'descending') : undefined}
      className={cn('px-3', align === 'end' && 'text-end')}
    >
      <button
        type="button"
        onClick={() => {
          onSort(column);
        }}
        className={cn(
          'focus-visible:outline-focus inline-flex cursor-pointer items-center gap-1 rounded-xs focus-visible:outline-2',
          active && 'text-fg',
        )}
      >
        {label}
        <Icon aria-hidden className="size-3.5" />
      </button>
    </th>
  );
}

function TableRow({
  stock,
  stale,
  onRemove,
}: {
  stock: StockWithQuote;
  stale: boolean;
  onRemove: (symbol: string) => void;
}) {
  const router = useRouter();
  const { t, f } = useI18n();
  const quote = useQuote(stock.symbol) ?? stock.quote;
  const pct = changePct(quote);
  const delta = change(quote);
  const href = `/stocks/${stock.symbol}` as Route;

  return (
    <tr
      tabIndex={0}
      className="hover:bg-surface-3 focus-visible:bg-surface-3 focus-visible:outline-focus cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 [&>td]:h-13 [&>td]:px-3"
      onClick={() => {
        router.push(href);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && event.target === event.currentTarget) router.push(href);
      }}
    >
      <td className="ps-5!">
        <Link href={href} tabIndex={-1} className="flex items-center gap-3">
          <StockAvatar symbol={stock.symbol} sector={stock.sector} />
          <span>
            <span className="type-symbol block">{stock.symbol}</span>
            <span className="type-caption text-fg-3 block">{stock.name}</span>
          </span>
        </Link>
      </td>
      <td className="text-end">
        <PriceFlash price={quote.price} format={(price) => formatPrice(f, price)} muted={stale} />
      </td>
      <td className={cn('text-end font-semibold tabular-nums', COLOR[direction(delta)])}>
        {formatChange(f, delta)}
      </td>
      <td className="text-end">
        <ChangePill value={pct} label={formatPct(f, pct)} size="sm" />
      </td>
      <td>
        <Sparkline values={stock.sparkline} direction={direction(pct)} width={96} height={28} />
      </td>
      <td>
        <div className="type-caption text-fg-3 flex items-center gap-2 tabular-nums">
          <span>{formatPrice(f, quote.dayLow)}</span>
          <span className="bg-surface-3 relative h-1 w-20 rounded-full">
            <span
              className="bg-fg-2 absolute -top-0.75 h-2.5 w-0.75 rounded-full"
              style={{
                insetInlineStart: `${String(rangePosition(quote.price, quote.dayLow, quote.dayHigh) * 100)}%`,
              }}
            />
          </span>
          <span>{formatPrice(f, quote.dayHigh)}</span>
        </div>
      </td>
      <td className="text-fg-2 text-end tabular-nums">{formatMarketCap(f, stock.marketCap)}</td>
      <td className="text-end">
        <StarButton
          label={watchLabel(t, stock.symbol, true)}
          watched
          size={36}
          onToggle={() => {
            onRemove(stock.symbol);
          }}
        />
      </td>
    </tr>
  );
}

export function WatchlistTable({
  rows,
  stale,
  sort,
  onSort,
  onRemove,
}: {
  rows: StockWithQuote[];
  stale: boolean;
  sort: SortOption | null;
  onSort: (key: SortKey) => void;
  onRemove: (symbol: string) => void;
}) {
  const columns = useI18n().t.watchlist.columns;
  return (
    <div className="border-border bg-surface overflow-x-auto rounded-lg border">
      <table className="type-sm [&_td]:border-border w-full border-separate border-spacing-0 [&_td]:border-b [&_tr:last-child_td]:border-b-0">
        <thead className="type-caption text-fg-3 [&_th]:border-border [&_th]:h-10 [&_th]:border-b [&_th]:font-semibold">
          <tr>
            <SortHeader label={columns.stock} column="name" sort={sort} onSort={onSort} />
            <SortHeader
              label={columns.price}
              column="price"
              sort={sort}
              onSort={onSort}
              align="end"
            />
            <th scope="col" className="px-3 text-end">
              {columns.change}
            </th>
            <SortHeader
              label={columns.changePct}
              column="change"
              sort={sort}
              onSort={onSort}
              align="end"
            />
            <th scope="col" className="px-3 text-start">
              {columns.today}
            </th>
            <th scope="col" className="px-3 text-start">
              {columns.dayRange}
            </th>
            <th scope="col" className="px-3 text-end">
              {columns.marketCap}
            </th>
            <th scope="col">
              <span className="sr-only">{columns.actions}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((stock) => (
            <TableRow key={stock.symbol} stock={stock} stale={stale} onRemove={onRemove} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GridCard({ stock, onRemove }: { stock: StockWithQuote; onRemove: (s: string) => void }) {
  const { t, f } = useI18n();
  const quote = useQuote(stock.symbol) ?? stock.quote;
  const pct = changePct(quote);
  return (
    <div className="border-border bg-surface hover:border-border-strong relative flex flex-col gap-3.5 rounded-lg border p-4.5">
      <div className="flex items-center gap-3">
        <StockAvatar symbol={stock.symbol} sector={stock.sector} />
        <Link
          href={`/stocks/${stock.symbol}` as Route}
          className="focus-visible:after:outline-focus min-w-0 flex-1 after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:outline-2"
        >
          <span className="type-symbol block">{stock.symbol}</span>
          <span className="type-caption text-fg-3 block truncate">{stock.name}</span>
        </Link>
        <StarButton
          label={watchLabel(t, stock.symbol, true)}
          watched
          size={36}
          className="relative z-10"
          onToggle={() => {
            onRemove(stock.symbol);
          }}
        />
      </div>
      <Sparkline values={stock.sparkline} direction={direction(pct)} className="h-14 w-full" />
      <div className="flex items-center justify-between">
        <PriceFlash price={quote.price} format={(price) => formatPrice(f, price)} size="lg" />
        <ChangePill value={pct} label={formatPct(f, pct)} />
      </div>
    </div>
  );
}

export function WatchlistGrid({
  rows,
  onRemove,
}: {
  rows: StockWithQuote[];
  onRemove: (symbol: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {rows.map((stock) => (
        <GridCard key={stock.symbol} stock={stock} onRemove={onRemove} />
      ))}
    </div>
  );
}

// Illustration geometry copied from the canvas (W-Watchlist empty state).
export function EmptyWatchlist() {
  const { t } = useI18n();
  return (
    <div className="border-border bg-surface flex flex-col items-center gap-3.5 rounded-lg border px-6 py-18 text-center">
      <div aria-hidden className="relative mb-2 h-32 w-42">
        <div className="bg-surface-3 absolute top-6.5 left-3.5 h-23 w-35 -rotate-8 rounded-[18px]" />
        <div className="border-border bg-surface-2 shadow-e2 absolute top-4.5 left-3.5 flex h-24 w-35 flex-col gap-2.5 rounded-[18px] border p-4">
          <div className="flex items-center gap-2">
            <div className="bg-brand-subtle rounded-control-sm size-6" />
            <div className="bg-border-strong h-2 w-14 rounded-xs" />
          </div>
          <svg width="108" height="34" viewBox="0 0 108 34" className="stroke-brand-fg">
            <path
              d="M2 28 L20 22 L34 25 L52 12 L66 16 L84 6 L106 9"
              fill="none"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="bg-brand text-on-brand shadow-e2 absolute top-0 right-0 grid size-13 place-items-center rounded-full">
          <Star className="size-6 fill-current" />
        </div>
      </div>
      <h2 className="type-h2">{t.watchlist.emptyTitle}</h2>
      <p className="type-body text-fg-2 max-w-105">
        {t.watchlist.emptyKeyHint.before} <kbd className="type-kbd">S</kbd>{' '}
        {t.watchlist.emptyKeyHint.after}
      </p>
      <Link href="/markets" className={cn(buttonVariants({ size: 'lg' }), 'mt-1.5')}>
        {t.watchlist.browse}
        <ChevronRight aria-hidden className="size-4 rtl:-scale-x-100" />
      </Link>
    </div>
  );
}
