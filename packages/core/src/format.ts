import { type Period, type Quote } from '@sarwa/contracts';

export type Direction = 'up' | 'down' | 'flat';

const MINUS = '−';

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const decimal = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const compact = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 2,
});

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

export function formatPrice(value: number): string {
  return usd.format(value);
}

function signed(value: number, formatted: string): string {
  const dir = direction(value);
  return dir === 'up' ? `+${formatted}` : dir === 'down' ? `${MINUS}${formatted}` : formatted;
}

export function formatPct(value: number): string {
  return `${signed(value, decimal.format(Math.abs(value)))}%`;
}

export function formatChange(value: number): string {
  return signed(value, decimal.format(Math.abs(value)));
}

export function formatCompact(value: number): string {
  return compact.format(value);
}

export function formatMarketCap(value: number): string {
  return `$${compact.format(value)}`;
}

export const DIRECTION_ARROW: Record<Direction, string> = { up: '▲', down: '▼', flat: '■' };

const DIRECTION_WORD: Record<Direction, string> = { up: 'up', down: 'down', flat: 'unchanged' };

export function formatQuoteLabel(quote: Pick<Quote, 'price' | 'prevClose'>): string {
  const pct = changePct(quote);
  const dir = direction(pct);
  const amount = dir === 'flat' ? '' : ` ${decimal.format(Math.abs(pct))}%`;
  return `${formatPrice(quote.price)}, ${DIRECTION_WORD[dir]}${amount} today`;
}

const CANDLE_TIME: Record<Period, Intl.DateTimeFormat> = {
  '1D': new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }),
  '1W': new Intl.DateTimeFormat('en-US', { weekday: 'short' }),
  '1M': new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }),
  '1Y': new Intl.DateTimeFormat('en-US', { month: 'short' }),
  ALL: new Intl.DateTimeFormat('en-US', { year: 'numeric' }),
};

export function formatCandleTime(t: number, period: Period): string {
  return CANDLE_TIME[period].format(t);
}
