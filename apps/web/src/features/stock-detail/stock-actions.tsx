'use client';

import { Bell, Star } from 'lucide-react';
import { type Route } from 'next';
import NextLink from 'next/link';

import { Button, buttonVariants } from '@sarwa/ui';

import { useStockActions } from './use-stock-detail-page';

export function StockActions({ symbol }: { symbol: string }) {
  const { watched, toggleWatch, labels } = useStockActions(symbol);
  return (
    <div className="flex gap-2">
      <NextLink
        href={`/alerts?new=${symbol}` as Route}
        className={buttonVariants({ variant: 'secondary' })}
      >
        <Bell aria-hidden className="size-4" />
        {labels.alert}
      </NextLink>
      <Button
        variant="secondary"
        aria-pressed={watched}
        aria-label={labels.watchA11y}
        icon={<Star aria-hidden className={watched ? 'text-star size-4 fill-current' : 'size-4'} />}
        onClick={toggleWatch}
      >
        {labels.watch}
      </Button>
    </div>
  );
}
