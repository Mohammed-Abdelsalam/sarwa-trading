import { type Route } from 'next';
import Link from 'next/link';

import { type Quote, type StockWithQuote } from '@sarwa/contracts';
import {
  change,
  changePct,
  direction,
  formatChange,
  formatPct,
  formatPrice,
  formatQuoteLabel,
  type KeyStat,
  useI18n,
  useQuote,
} from '@sarwa/core';
import { ChangePill, cn, PriceFlash, Skeleton, Sparkline, StockAvatar } from '@sarwa/ui';

// No live region: the price ticks several times a second and would never stop being read.
export function PriceSummary({ quote, live }: { quote: Quote | undefined; live: boolean }) {
  const i18n = useI18n();
  const { t, f } = i18n;
  if (!quote) return <Skeleton className="h-15 w-72" />;
  const delta = change(quote);
  return (
    <div
      className="flex flex-wrap items-end gap-4"
      role="group"
      aria-label={formatQuoteLabel(i18n, quote)}
    >
      <PriceFlash
        price={quote.price}
        format={(price) => formatPrice(f, price)}
        size="display-web"
        className="max-md:type-display"
      />
      <ChangePill
        value={delta}
        label={`${formatChange(f, delta)} (${formatPct(f, changePct(quote))})`}
        size="lg"
        className="mb-2"
      />
      <span className="type-sm text-fg-3 mb-3">
        {t.stock.today({ time: f.time(quote.ts) })}
        {live ? ` · ${t.common.live}` : ''}
      </span>
    </div>
  );
}

export function KeyStats({ stats, layout }: { stats: KeyStat[]; layout: 'grid' | 'list' }) {
  const { t } = useI18n();
  if (layout === 'list') {
    return (
      <section className="border-border bg-surface overflow-hidden rounded-lg border">
        <div className="border-border flex items-baseline justify-between border-b px-4.5 py-3.5">
          <h2 className="type-h3">{t.stock.keyStats}</h2>
          <span className="type-caption text-fg-3">{t.stock.simulated}</span>
        </div>
        <dl>
          {stats.map(({ label, value }) => (
            <div
              key={label}
              className="border-border flex h-12 items-center justify-between border-b px-4.5 last:border-b-0"
            >
              <dt className="type-sm text-fg-2">{label}</dt>
              <dd className="type-num-md">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
    );
  }
  return (
    <dl className="border-border bg-surface grid grid-cols-2 overflow-hidden rounded-lg border xl:grid-cols-4">
      {stats.map(({ label, value }) => (
        <div key={label} className="border-border flex flex-col gap-1 border-b px-4.5 py-3.5">
          <dt className="type-overline text-fg-3">{label}</dt>
          <dd className="type-num-md">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function RangeCard({
  low,
  high,
  position,
}: {
  low: number;
  high: number;
  position: number;
}) {
  const { t, f } = useI18n();
  const weeks = f.count(52);
  return (
    <section className="border-border bg-surface flex flex-col gap-2.5 rounded-lg border px-4.5 py-4">
      <h2 className="type-overline text-fg-3">{t.stock.range(weeks)}</h2>
      {/* A price scale runs low to high left to right in every locale, like the chart. */}
      <div
        dir="ltr"
        role="meter"
        aria-label={t.stock.rangeLabel(weeks)}
        aria-valuemin={low}
        aria-valuemax={high}
        aria-valuenow={low + (high - low) * position}
        className="bg-surface-3 relative h-1.5 rounded-full"
      >
        <div
          className="from-neg via-warn to-pos absolute inset-y-0 left-0 rounded-full bg-linear-to-r"
          style={{ width: `${String(position * 100)}%` }}
        />
        <span
          aria-hidden
          className="bg-fg absolute -top-1.25 -ml-0.5 h-4 w-1 rounded-xs"
          style={{ left: `${String(position * 100)}%` }}
        />
      </div>
      <div dir="ltr" className="type-num-sm text-fg-2 flex justify-between">
        <span>{formatPrice(f, low)}</span>
        <span>{formatPrice(f, high)}</span>
      </div>
    </section>
  );
}

function SimilarCard({ stock }: { stock: StockWithQuote }) {
  const { f } = useI18n();
  const quote = useQuote(stock.symbol) ?? stock.quote;
  const pct = changePct(quote);
  return (
    <Link
      href={`/stocks/${stock.symbol}` as Route}
      className="border-border bg-surface hover:border-border-strong focus-visible:outline-focus flex flex-col gap-2.5 rounded-lg border px-4 py-3.5 focus-visible:outline-2"
    >
      <span className="flex items-center gap-2.5">
        <StockAvatar symbol={stock.symbol} sector={stock.sector} size={32} />
        <span className="min-w-0">
          <span className="type-symbol block">{stock.symbol}</span>
          <span className="type-caption text-fg-3 block truncate">{stock.name}</span>
        </span>
      </span>
      <Sparkline values={stock.sparkline} direction={direction(pct)} className="h-8 w-full" />
      <span className="flex items-center justify-between">
        <span className="type-num-md">{formatPrice(f, quote.price)}</span>
        <ChangePill value={pct} label={formatPct(f, pct)} size="sm" />
      </span>
    </Link>
  );
}

export function SimilarStocks({ title, stocks }: { title: string; stocks: StockWithQuote[] }) {
  if (stocks.length === 0) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="type-h3">{title}</h2>
      <div className={cn('grid grid-cols-2 gap-3 md:grid-cols-4')}>
        {stocks.map((stock) => (
          <SimilarCard key={stock.symbol} stock={stock} />
        ))}
      </div>
    </section>
  );
}
