import {
  type Quote,
  type Sector,
  SECTOR_LABELS,
  SECTORS,
  type StockDetailResponse,
  type StockWithQuote,
} from '@sarwa/contracts';

import { changePct, formatCompact, formatMarketCap, formatPrice } from './format';

export type SectorFilter = Sector | 'all';

export const SECTOR_FILTERS: readonly { id: SectorFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  ...SECTORS.map((id) => ({ id, label: SECTOR_LABELS[id] })),
];

export function sectorFilterLabel(id: SectorFilter): string {
  return id === 'all' ? 'All' : SECTOR_LABELS[id];
}

export const SORTS = [
  { label: 'Name', key: 'name', dir: 1 },
  { label: 'Name', key: 'name', dir: -1 },
  { label: 'Price', key: 'price', dir: -1 },
  { label: 'Price', key: 'price', dir: 1 },
  { label: '% Change', key: 'change', dir: -1 },
  { label: '% Change', key: 'change', dir: 1 },
] as const;

export type SortOption = (typeof SORTS)[number];
export type SortKey = SortOption['key'];

export const DEFAULT_SORT: SortOption = SORTS[4];

export function nextSort(current: SortOption): SortOption {
  return SORTS[(SORTS.indexOf(current) + 1) % SORTS.length] ?? SORTS[0];
}

// null keeps the server order, which is the order the stocks were starred in.
export const WATCHLIST_ORDER_LABEL = 'Order added';

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

export function keyStats({ stock, stats }: StockDetailResponse, quote: Quote): KeyStat[] {
  return [
    { label: 'Market cap', value: formatMarketCap(stats.marketCap) },
    { label: 'P/E (TTM)', value: stats.peRatio?.toFixed(1) ?? '—' },
    { label: '52W high', value: formatPrice(stats.week52High) },
    { label: '52W low', value: formatPrice(stats.week52Low) },
    { label: 'Open', value: formatPrice(quote.open) },
    { label: 'Volume', value: formatCompact(quote.volume) },
    { label: 'Sector', value: SECTOR_LABELS[stock.sector] },
    { label: 'Exchange', value: stock.exchange },
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
