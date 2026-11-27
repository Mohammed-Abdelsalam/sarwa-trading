import {
  type Quote,
  type Sector,
  SECTORS,
  type StockDetailResponse,
  type StockWithQuote,
} from '@sarwa/contracts';
import { type Messages } from '@sarwa/i18n';

import { changePct, formatMarketCap, formatPrice, type Localized } from './format';

export type SectorFilter = Sector | 'all';

export const SECTOR_FILTERS: readonly SectorFilter[] = ['all', ...SECTORS];

export function sectorFilterLabel(t: Messages, id: SectorFilter): string {
  return id === 'all' ? t.markets.allSectors : t.sectors[id];
}

export const SORTS = [
  { key: 'name', dir: 1 },
  { key: 'name', dir: -1 },
  { key: 'price', dir: -1 },
  { key: 'price', dir: 1 },
  { key: 'change', dir: -1 },
  { key: 'change', dir: 1 },
] as const;

export type SortOption = (typeof SORTS)[number];
export type SortKey = SortOption['key'];

export const DEFAULT_SORT: SortOption = SORTS[4];

// A null sort keeps the server order, which is the order the stocks were starred in.
export function sortLabel(t: Messages, sort: SortOption | null): string {
  return sort ? t.sort.keys[sort.key] : t.sort.orderAdded;
}

export function watchLabel(t: Messages, symbol: string, watched: boolean): string {
  return watched ? t.watchlist.removeSymbol({ symbol }) : t.watchlist.addSymbol({ symbol });
}

export function nextSort(current: SortOption): SortOption {
  return SORTS[(SORTS.indexOf(current) + 1) % SORTS.length] ?? SORTS[0];
}

export function nextWatchlistSort(current: SortOption | null): SortOption | null {
  if (current === null) return SORTS[0];
  return SORTS[SORTS.indexOf(current) + 1] ?? null;
}

const SORT_VALUE = {
  name: (s: StockWithQuote) => s.symbol,
  price: (s: StockWithQuote) => s.quote.price,
  change: (s: StockWithQuote) => changePct(s.quote),
};

export interface MarketFilter {
  query: string;
  sector: SectorFilter;
  sort: SortOption;
}

// Sorts on the REST snapshot, not live ticks, so rows don't jump around while the user reads.
export function sortStocks(stocks: readonly StockWithQuote[], sort: SortOption): StockWithQuote[] {
  const value = SORT_VALUE[sort.key];
  return [...stocks].sort((a, b) => {
    const [x, y] = [value(a), value(b)];
    return (x > y ? 1 : x < y ? -1 : 0) * sort.dir;
  });
}

export function filterAndSort(
  stocks: readonly StockWithQuote[],
  { query, sector, sort }: MarketFilter,
): StockWithQuote[] {
  const q = query.trim().toLowerCase();
  return sortStocks(
    stocks
      .filter((s) => sector === 'all' || s.sector === sector)
      .filter((s) => !q || s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)),
    sort,
  );
}

export function averageChangePct(quotes: readonly Quote[]): number | null {
  if (quotes.length === 0) return null;
  const sum = quotes.reduce((total, q) => total + changePct(q), 0);
  return Math.round((sum / quotes.length) * 100) / 100;
}

export interface KeyStat {
  label: string;
  value: string;
}

const WEEKS_PER_YEAR = 52;

export function keyStats(
  { t, f }: Localized,
  { stock, stats }: StockDetailResponse,
  quote: Quote,
): KeyStat[] {
  const labels = t.stock.stats;
  const weeks = f.count(WEEKS_PER_YEAR);
  return [
    { label: labels.marketCap, value: formatMarketCap(f, stats.marketCap) },
    {
      label: labels.pe,
      value: stats.peRatio === null ? '—' : f.number(Math.round(stats.peRatio * 10) / 10),
    },
    { label: labels.weekHigh(weeks), value: formatPrice(f, stats.week52High) },
    { label: labels.weekLow(weeks), value: formatPrice(f, stats.week52Low) },
    { label: labels.open, value: formatPrice(f, quote.open) },
    { label: labels.volume, value: f.compact(quote.volume) },
    { label: labels.sector, value: t.sectors[stock.sector] },
    { label: labels.exchange, value: stock.exchange },
  ];
}

export function similarStocks(
  stocks: readonly StockWithQuote[],
  symbol: string,
  limit = 4,
): StockWithQuote[] {
  const sector = stocks.find((s) => s.symbol === symbol)?.sector;
  if (!sector) return [];
  return stocks.filter((s) => s.sector === sector && s.symbol !== symbol).slice(0, limit);
}

// Where a value sits between a low and a high, 0–1, for the 52-week and day-range bars.
export function rangePosition(value: number, low: number, high: number): number {
  if (high <= low) return 0.5;
  return Math.min(Math.max((value - low) / (high - low), 0), 1);
}

// A sortable column header: first click sorts by that column, the next click flips the direction.
export function sortByColumn(current: SortOption | null, key: SortKey): SortOption {
  const options = SORTS.filter((s) => s.key === key);
  const flipped = current?.key === key ? options.find((s) => s.dir !== current.dir) : undefined;
  return flipped ?? options[0] ?? SORTS[0];
}
