'use client';

import { RemovedStock } from './removed-stock';
import { useRemovedStock } from './use-removed-stock';

export function RemovedStockPage({ symbol }: { symbol: string }) {
  const view = useRemovedStock(symbol);
  return (
    <RemovedStock symbol={symbol} watched={view.watched} onRemove={view.removeFromWatchlist} />
  );
}
