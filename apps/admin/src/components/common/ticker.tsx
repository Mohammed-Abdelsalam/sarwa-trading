import { useI18n } from '@sarwa/core';
import { type TickerRow, dollarsToCents } from '@sarwa/core/admin';
import { ChangePill, cn, PriceFlash, Skeleton, Sparkline, StockAvatar } from '@sarwa/ui';

export function TickerRows({
  rows,
  isLoading = false,
  frozen = false,
  sparkline = false,
  className,
}: {
  rows: readonly TickerRow[];
  isLoading?: boolean;
  frozen?: boolean;
  sparkline?: boolean;
  className?: string;
}) {
  const { f } = useI18n();
  const money = (price: number) => f.money(dollarsToCents(price));

  if (isLoading) {
    return (
      <div className={className} aria-hidden>
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <Skeleton className="size-8 rounded-md" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <ul className={className}>
      {rows.map((row) => (
        <li
          key={row.symbol}
          className="border-border flex items-center justify-between gap-3 border-b px-4 py-2.5 last:border-b-0"
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <StockAvatar symbol={row.symbol} sector={row.sector} size={32} />
            <b className="type-sm text-fg">{row.symbol}</b>
          </span>
          {sparkline ? (
            <Sparkline
              values={row.sparkline}
              direction={row.changeBps > 0 ? 'up' : row.changeBps < 0 ? 'down' : 'flat'}
              width={80}
              height={24}
            />
          ) : null}
          <span className="flex items-center gap-2.5">
            <PriceFlash
              price={row.price}
              format={money}
              muted={frozen}
              className={cn(frozen && 'bg-surface-3')}
            />
            <ChangePill
              value={row.changeBps}
              label={f.percent(row.changeBps, { signed: true })}
              size="sm"
            />
          </span>
        </li>
      ))}
    </ul>
  );
}
