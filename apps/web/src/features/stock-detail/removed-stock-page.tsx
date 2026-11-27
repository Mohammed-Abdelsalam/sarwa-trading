'use client';

import { useWatchToggle } from '@sarwa/core';

import { RemovedStock } from './removed-stock';

// Removing a stock that no longer exists is final, so this toggle skips the undo window.
export function RemovedStockPage({ symbol }: { symbol: string }) {
  const { watched, toggle } = useWatchToggle(symbol);
  return <RemovedStock symbol={symbol} watched={watched} onRemove={toggle} />;
}
