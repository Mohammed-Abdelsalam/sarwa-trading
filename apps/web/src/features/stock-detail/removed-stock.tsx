import { Ban, Star } from 'lucide-react';
import Link from 'next/link';

import { useI18n } from '@sarwa/core';
import { Button, buttonVariants, cn } from '@sarwa/ui';

// A deep link to a stock that was disabled or removed (X-A11y): explain it instead of a bare 404.
export function RemovedStock({
  symbol,
  watched = false,
  onRemove,
}: {
  symbol: string;
  watched?: boolean;
  onRemove?: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="mx-auto flex max-w-110 flex-col items-center gap-4 px-6 py-20 text-center">
      <div aria-hidden className="relative">
        <div className="size-art rounded-art border-border bg-surface type-avatar-lg text-fg-2 grid place-items-center border">
          {symbol.charAt(0)}
        </div>
        <span className="bg-neg text-on-brand absolute -end-1 -bottom-1 grid size-9 place-items-center rounded-full">
          <Ban className="size-4" />
        </span>
      </div>
      <span className="type-mono text-fg-3">stocks/{symbol}</span>
      <h1 className="type-h2">{t.stock.removedTitle}</h1>
      <p className="type-body text-fg-2">{t.stock.removedBody({ symbol })}</p>
      <div className="mt-2 flex w-full flex-col gap-2.5">
        <Link href="/markets" className={cn(buttonVariants({ size: 'lg' }), 'w-full')}>
          {t.stock.backToMarkets}
        </Link>
        {watched && onRemove ? (
          <Button
            size="lg"
            variant="secondary"
            className="w-full"
            icon={<Star aria-hidden className="size-4" />}
            onClick={onRemove}
          >
            {t.stock.removeFromWatchlist}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
