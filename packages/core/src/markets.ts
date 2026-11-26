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

export const SORTS = [
  { label: 'Name', key: 'name', dir: 1 },
  { label: 'Name', key: 'name', dir: -1 },
  { label: 'Price', key: 'price', dir: -1 },
  { label: 'Price', key: 'price', dir: 1 },
  { label: '% Change', key: 'change', dir: -1 },
  { label: '% Change', key: 'change', dir: 1 },
] as const;

export type SortOption = (typeof SORTS)[number];

export const DEFAULT_SORT: SortOption = SORTS[4];

export function nextSort(current: SortOption): SortOption {
  return SORTS[(SORTS.indexOf(current) + 1) % SORTS.length] ?? SORTS[0];
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
export function filterAndSort(
  stocks: readonly StockWithQuote[],
  { query, sector, sort }: MarketFilter,
): StockWithQuote[] {
  const q = query.trim().toLowerCase();
  const value = SORT_VALUE[sort.key];
  return stocks
    .filter((s) => sector === 'all' || s.sector === sector)
    .filter((s) => !q || s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
    .sort((a, b) => {
      const [x, y] = [value(a), value(b)];
      return (x > y ? 1 : x < y ? -1 : 0) * sort.dir;
    });
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
