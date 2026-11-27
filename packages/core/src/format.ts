import { type Quote } from '@sarwa/contracts';
import { absolute, dollarsToCents, percentToBps } from '@sarwa/domain';
import { type Formatter, type Messages } from '@sarwa/i18n';

export type Direction = 'up' | 'down' | 'flat';

// The active catalog and formatter (useI18n's t and f): every label here follows locale and digits.
export interface Localized {
  t: Messages;
  f: Formatter;
}

export function change(quote: Pick<Quote, 'price' | 'prevClose'>): number {
  return quote.price - quote.prevClose;
}

export function changePct(quote: Pick<Quote, 'price' | 'prevClose'>): number {
  return ((quote.price - quote.prevClose) / quote.prevClose) * 100;
}

export function direction(value: number): Direction {
  const rounded = Math.round(value * 100);
  return rounded > 0 ? 'up' : rounded < 0 ? 'down' : 'flat';
}

// Market quotes carry dollars and percents as floats; these hand them to the formatter in its units.
export function formatPrice(f: Formatter, dollars: number): string {
  return f.money(dollarsToCents(dollars));
}

export function formatPct(f: Formatter, pct: number): string {
  return f.percent(percentToBps(pct), { signed: true });
}

export function formatChange(f: Formatter, dollars: number): string {
  return f.money(dollarsToCents(dollars), { signed: true });
}

export function formatMarketCap(f: Formatter, dollars: number): string {
  return f.money(dollarsToCents(dollars), { compact: true });
}

// Lists drop cents from six-figure prices so the price column never truncates.
export function formatListPrice(f: Formatter, dollars: number): string {
  return f.money(dollarsToCents(dollars), { whole: dollars >= 100_000 });
}

export const DIRECTION_ARROW: Record<Direction, string> = { up: '▲', down: '▼', flat: '■' };

function move({ f }: Localized, quote: Pick<Quote, 'price' | 'prevClose'>) {
  const pct = changePct(quote);
  return {
    dir: direction(pct),
    price: formatPrice(f, quote.price),
    pct: f.percent(absolute(percentToBps(pct))),
  };
}

export function formatQuoteLabel(
  i18n: Localized,
  quote: Pick<Quote, 'price' | 'prevClose'>,
): string {
  const { dir, ...params } = move(i18n, quote);
  return i18n.t.stock.quoteLabel[dir](params);
}

export function formatStockLabel(
  i18n: Localized,
  {
    symbol,
    name,
    quote,
    watched,
  }: { symbol: string; name: string; quote: Pick<Quote, 'price' | 'prevClose'>; watched?: boolean },
): string {
  const { dir, ...params } = move(i18n, quote);
  const label = i18n.t.stock.rowLabel[dir]({ ...params, symbol, name });
  return watched ? `${label} ${i18n.t.stock.inWatchlist}` : label;
}

export function shareStockMessage(
  { t, f }: Localized,
  {
    symbol,
    name,
    quote,
  }: { symbol: string; name: string; quote: Pick<Quote, 'price' | 'prevClose'> },
): string {
  return t.stock.shareMessage({
    symbol,
    name,
    price: formatPrice(f, quote.price),
    pct: formatPct(f, changePct(quote)),
  });
}
