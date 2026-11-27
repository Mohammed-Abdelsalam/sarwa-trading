import { type Route } from 'next';
import Link from 'next/link';
import { type KeyboardEvent, memo } from 'react';

import { type StockWithQuote } from '@sarwa/contracts';
import {
  changePct,
  direction,
  formatListPrice,
  formatPct,
  formatStockLabel,
  useI18n,
  useQuote,
  watchLabel,
} from '@sarwa/core';
import {
  ChangePill,
  cn,
  PriceFlash,
  Skeleton,
  Sparkline,
  StarButton,
  StockAvatar,
} from '@sarwa/ui';

export interface StockRowProps {
  stock: StockWithQuote;
  href: Route;
  watched?: boolean;
  onToggleWatch?: (symbol: string, watched: boolean) => void;
  selected?: boolean;
  stale?: boolean;
  onSelect?: (symbol: string) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLAnchorElement>) => void;
}

// Each row subscribes to its own quote, so a tick re-renders only the row whose price changed.
export const StockRow = memo(function StockRow({
  stock,
  href,
  watched = false,
  onToggleWatch,
  selected = false,
  stale = false,
  onSelect,
  onKeyDown,
}: StockRowProps) {
  const i18n = useI18n();
  const { t, f } = i18n;
  const quote = useQuote(stock.symbol) ?? stock.quote;
  const pct = changePct(quote);

  return (
    <div
      role="listitem"
      className={cn(
        'hover:bg-surface-3 relative flex min-h-16 items-center',
        selected &&
          'bg-brand-subtle before:bg-brand before:absolute before:top-2.5 before:bottom-2.5 before:left-0 before:w-0.75 before:rounded-r-xs',
      )}
    >
      <Link
        href={href}
        scroll={false}
        data-row={stock.symbol}
        aria-current={selected ? 'true' : undefined}
        onKeyDown={onKeyDown}
        aria-label={formatStockLabel(i18n, {
          symbol: stock.symbol,
          name: stock.name,
          quote,
          watched,
        })}
        onClick={(event) => {
          const newTab = event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0;
          if (!onSelect || newTab) return;
          event.preventDefault();
          onSelect(stock.symbol);
        }}
        className="focus-visible:outline-focus rounded-control-lg flex min-w-0 flex-1 items-center gap-3 py-2.5 pr-2 pl-4 focus-visible:outline-2 focus-visible:-outline-offset-2"
      >
        <StockAvatar symbol={stock.symbol} sector={stock.sector} />
        <span className="min-w-0 flex-1">
          <span className="type-symbol block">{stock.symbol}</span>
          <span className="type-sm text-fg-3 block truncate">{stock.name}</span>
        </span>
        <Sparkline
          values={stock.sparkline}
          direction={direction(pct)}
          className="shrink-0 max-md:hidden"
        />
        <span className="w-price-col-wide flex shrink-0 flex-col items-end gap-1">
          <PriceFlash
            price={quote.price}
            format={(price) => formatListPrice(f, price)}
            muted={stale}
          />
          <ChangePill
            value={pct}
            label={formatPct(f, pct)}
            size="sm"
            className={stale ? 'opacity-70' : undefined}
          />
        </span>
      </Link>
      {onToggleWatch ? (
        <StarButton
          label={watchLabel(t, stock.symbol, watched)}
          watched={watched}
          size={36}
          className="mr-2"
          onToggle={() => {
            onToggleWatch(stock.symbol, watched);
          }}
        />
      ) : null}
    </div>
  );
});

export function StockListSkeleton({ rows }: { rows: number }) {
  const { t } = useI18n();
  return (
    <div role="progressbar" aria-label={t.markets.loading} aria-busy>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex min-h-16 items-center gap-3 py-2.5 pr-4 pl-4">
          <Skeleton className="rounded-control-lg size-10" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-14" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="h-6.5 w-15 opacity-60" />
          <div className="w-price-col-wide flex flex-col items-end gap-1.5">
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-pill-sm w-pill-sm-min" />
          </div>
        </div>
      ))}
    </div>
  );
}
