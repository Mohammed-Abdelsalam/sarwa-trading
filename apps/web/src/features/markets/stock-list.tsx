import { type Route } from 'next';
import { type KeyboardEvent } from 'react';

import { type StockWithQuote } from '@sarwa/contracts';

import { StockRow } from '../../components/trading/stock-row';

// ↑ ↓ move between rows, Enter opens the full page, S stars the focused row (W-Markets).
// In two-pane mode moving also selects, so the preview follows the keyboard like a click would.
function onRowKeyDown(
  event: KeyboardEvent<HTMLAnchorElement>,
  handlers: {
    toggleWatch: (symbol: string) => void;
    select?: (symbol: string) => void;
    open?: (symbol: string) => void;
  },
) {
  const list = event.currentTarget.closest('[role="list"]');
  const rows = list ? [...list.querySelectorAll<HTMLAnchorElement>('[data-row]')] : [];
  const index = rows.indexOf(event.currentTarget);
  const symbol = event.currentTarget.dataset.row;
  if (index === -1 || !symbol) return;
  const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
  if (step) {
    event.preventDefault();
    const next = rows[Math.min(rows.length - 1, Math.max(0, index + step))];
    next?.focus();
    if (next?.dataset.row) handlers.select?.(next.dataset.row);
  } else if (event.key === 'Enter' && handlers.open) {
    event.preventDefault();
    handlers.open(symbol);
  } else if (event.key.toLowerCase() === 's' && !event.metaKey && !event.ctrlKey) {
    event.preventDefault();
    handlers.toggleWatch(symbol);
  }
}

export function StockList({
  rows,
  watched,
  selected,
  stale,
  rowHref,
  onSelect,
  onOpen,
  onToggleWatch,
}: {
  rows: StockWithQuote[];
  watched: ReadonlySet<string>;
  selected?: string;
  stale: boolean;
  rowHref: (symbol: string) => Route;
  onSelect?: (symbol: string) => void;
  onOpen?: (symbol: string) => void;
  onToggleWatch: (symbol: string, watched: boolean) => void;
}) {
  return (
    <div role="list" aria-label="Stocks" className="border-border flex-1 overflow-y-auto border-t">
      {rows.map((stock) => (
        <StockRow
          key={stock.symbol}
          stock={stock}
          href={rowHref(stock.symbol)}
          watched={watched.has(stock.symbol)}
          onToggleWatch={onToggleWatch}
          onSelect={onSelect}
          selected={stock.symbol === selected}
          stale={stale}
          onKeyDown={(event) => {
            onRowKeyDown(event, {
              toggleWatch: (symbol) => {
                onToggleWatch(symbol, watched.has(symbol));
              },
              select: onSelect,
              open: onOpen,
            });
          }}
        />
      ))}
    </div>
  );
}
