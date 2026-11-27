import { ArrowUpRight } from 'lucide-react';
import { type Route } from 'next';
import Link from 'next/link';

import { useI18n, watchLabel } from '@sarwa/core';
import { Badge, buttonVariants, cn, StarButton, StockAvatar } from '@sarwa/ui';

import { ChartToolbar } from '../stock-detail/chart-toolbar';
import { KeyStats, PriceSummary } from '../stock-detail/detail-parts';
import { PriceChart } from '../stock-detail/price-chart';
import { useStockPreview } from './use-stock-preview';

export function StockPreview({ symbol, className }: { symbol: string; className?: string }) {
  const { t } = useI18n();
  const preview = useStockPreview(symbol);
  const { stock, quote, stats } = preview;

  return (
    <section
      aria-label={t.markets.detail({ symbol })}
      className={cn('flex min-w-0 flex-1 flex-col gap-5 overflow-y-auto px-8 py-7', className)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3.5">
          {stock ? <StockAvatar symbol={symbol} sector={stock.sector} size={56} /> : null}
          <div>
            <div className="flex items-center gap-2">
              <h2 className="type-h1">{symbol}</h2>
              {stock ? <Badge square>{stock.exchange}</Badge> : null}
              {preview.sectorLabel ? <Badge>{preview.sectorLabel}</Badge> : null}
            </div>
            <p className="type-sm text-fg-2">{stock?.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StarButton
            label={watchLabel(t, symbol, preview.watched)}
            watched={preview.watched}
            onToggle={preview.toggleWatch}
          />
          <Link
            href={`/stocks/${symbol}` as Route}
            className={buttonVariants({ variant: 'secondary' })}
          >
            {t.markets.openFullPage}
            <ArrowUpRight aria-hidden className="size-4" />
          </Link>
        </div>
      </div>

      <PriceSummary quote={quote} live={preview.live} />

      <PriceChart
        symbol={symbol}
        period={preview.period}
        height={280}
        toolbar={(change) => (
          <ChartToolbar
            period={preview.period}
            enabledPeriods={preview.enabledPeriods}
            onPeriodChange={preview.setPeriod}
            change={change}
          />
        )}
      />

      {stats ? <KeyStats stats={stats} layout="grid" /> : null}
    </section>
  );
}
