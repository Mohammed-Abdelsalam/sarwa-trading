import { type StockWithQuote } from '@sarwa/contracts';

import {
  averageChangePct,
  filterAndSort,
  keyStats,
  nextSort,
  nextWatchlistSort,
  rangePosition,
  SECTOR_FILTERS,
  sectorFilterLabel,
  similarStocks,
  sortByColumn,
  sortLabel,
  SORTS,
  sortStocks,
  watchLabel,
} from '../src/markets';
import { localized, makeQuote } from './utils';

function stock(
  symbol: string,
  name: string,
  sector: StockWithQuote['sector'],
  price: number,
  prevClose: number,
): StockWithQuote {
  return {
    symbol,
    name,
    sector,
    exchange: 'NASDAQ',
    currency: 'USD',
    sparkline: [1, 2],
    marketCap: 1_000_000_000,
    quote: makeQuote({ symbol, price, prevClose }),
  };
}

const stocks = [
  stock('AAPL', 'Apple Inc.', 'tech', 230, 220),
  stock('TSLA', 'Tesla Inc.', 'consumer', 240, 250),
  stock('JPM', 'JPMorgan Chase', 'fin', 200, 199),
];

const byName = SORTS[0];
const byChangeDesc = SORTS[4];

describe('filterAndSort', () => {
  it('searches symbols and company names case-insensitively', () => {
    expect(
      filterAndSort(stocks, { query: 'tes', sector: 'all', sort: byName }).map((s) => s.symbol),
    ).toEqual(['TSLA']);
    expect(
      filterAndSort(stocks, { query: 'apple', sector: 'all', sort: byName }).map((s) => s.symbol),
    ).toEqual(['AAPL']);
  });

  it('filters by sector', () => {
    expect(
      filterAndSort(stocks, { query: '', sector: 'fin', sort: byName }).map((s) => s.symbol),
    ).toEqual(['JPM']);
  });

  it('sorts by % change, biggest gainer first', () => {
    expect(
      filterAndSort(stocks, { query: '', sector: 'all', sort: byChangeDesc }).map((s) => s.symbol),
    ).toEqual(['AAPL', 'JPM', 'TSLA']);
  });

  it('does not mutate the input list', () => {
    const copy = [...stocks];
    filterAndSort(stocks, { query: '', sector: 'all', sort: byChangeDesc });
    expect(stocks).toEqual(copy);
  });
});

describe('nextSort', () => {
  it('cycles through every option and wraps around', () => {
    expect(nextSort(SORTS[0])).toBe(SORTS[1]);
    expect(nextSort(SORTS[5])).toBe(SORTS[0]);
  });
});

describe('averageChangePct', () => {
  it('averages the day change, rounded to two decimals', () => {
    expect(
      averageChangePct([
        makeQuote({ price: 110, prevClose: 100 }),
        makeQuote({ price: 95, prevClose: 100 }),
      ]),
    ).toBe(2.5);
  });

  it('returns null when nothing is priced yet', () => {
    expect(averageChangePct([])).toBeNull();
  });
});

describe('keyStats', () => {
  const quote = makeQuote({ open: 229.1, volume: 52_300_000 });
  const detail = (peRatio: number | null) => ({
    stock: {
      symbol: 'AAPL',
      name: 'Apple',
      sector: 'tech' as const,
      exchange: 'NASDAQ' as const,
      currency: 'USD' as const,
    },
    quote,
    stats: { marketCap: 3_500_000_000_000, peRatio, week52High: 260, week52Low: 160, avgVolume: 1 },
  });

  it('formats the stats grid, with a dash for a missing P/E', () => {
    const stats = keyStats(localized(), detail(null), quote);

    expect(stats).toContainEqual({ label: 'P/E (TTM)', value: '—' });
    expect(stats).toContainEqual({ label: 'Market cap', value: '$3.5T' });
    expect(stats).toContainEqual({ label: 'Volume', value: '52.3M' });
    expect(stats).toContainEqual({ label: '52W high', value: '$260.00' });
    expect(stats).toContainEqual({ label: 'Sector', value: 'Technology' });
  });

  it('labels and formats every stat in Arabic with Arabic-Indic digits', () => {
    const stats = keyStats(localized('ar', 'arab'), detail(28.43), quote);

    expect(stats).toContainEqual({ label: 'مكرر الربحية (TTM)', value: '٢٨٫٤' });
    expect(stats).toContainEqual({ label: 'أعلى ٥٢ أسبوع', value: '⁦$٢٦٠٫٠٠⁩' });
    expect(stats).toContainEqual({ label: 'القطاع', value: 'التكنولوجيا' });
  });
});

describe('similarStocks', () => {
  it('lists other stocks from the same sector', () => {
    const list = [...stocks, stock('MSFT', 'Microsoft', 'tech', 400, 390)];
    expect(similarStocks(list, 'AAPL').map((s) => s.symbol)).toEqual(['MSFT']);
    expect(similarStocks(list, 'ZZZZ')).toEqual([]);
  });
});

describe('rangePosition', () => {
  it('places a value between low and high, clamped to the bar', () => {
    expect(rangePosition(150, 100, 200)).toBe(0.5);
    expect(rangePosition(250, 100, 200)).toBe(1);
    expect(rangePosition(5, 5, 5)).toBe(0.5);
  });
});

describe('sortByColumn', () => {
  it('sorts by a new column first, then flips its direction', () => {
    const byPrice = sortByColumn(null, 'price');
    expect(byPrice).toMatchObject({ key: 'price', dir: -1 });
    expect(sortByColumn(byPrice, 'price')).toMatchObject({ key: 'price', dir: 1 });
    expect(sortByColumn(byPrice, 'name')).toMatchObject({ key: 'name', dir: 1 });
  });
});

describe('sectorFilterLabel', () => {
  it('names each sector filter, including All', () => {
    const { t } = localized();
    expect(SECTOR_FILTERS[0]).toBe('all');
    expect(sectorFilterLabel(t, 'all')).toBe('All');
    expect(sectorFilterLabel(t, 'fin')).toBe('Finance');
  });

  it('names them in Arabic', () => {
    const { t } = localized('ar');
    expect(sectorFilterLabel(t, 'all')).toBe('الكل');
    expect(sectorFilterLabel(t, 'fin')).toBe('المال');
  });
});

describe('watchLabel', () => {
  it('says what the star does for that symbol', () => {
    expect(watchLabel(localized().t, 'AAPL', false)).toBe('Add AAPL to watchlist');
    expect(watchLabel(localized().t, 'AAPL', true)).toBe('Remove AAPL from watchlist');
    expect(watchLabel(localized('ar').t, 'AAPL', true)).toBe('أزل AAPL من المفضلة');
  });
});

describe('sortLabel', () => {
  it('names the sort key, or the added order when there is no sort', () => {
    expect(sortLabel(localized().t, SORTS[4])).toBe('% Change');
    expect(sortLabel(localized().t, null)).toBe('Order added');
    expect(sortLabel(localized('ar').t, SORTS[0])).toBe('الاسم');
  });
});

describe('sortStocks', () => {
  it('sorts a copy and leaves the input order alone', () => {
    const input = [...stocks];

    expect(sortStocks(input, byName).map((s) => s.symbol)).toEqual(['AAPL', 'JPM', 'TSLA']);
    expect(input.map((s) => s.symbol)).toEqual(['AAPL', 'TSLA', 'JPM']);
  });
});

describe('nextWatchlistSort', () => {
  it('cycles from the added order through every sort and back', () => {
    const seen = [nextWatchlistSort(null)];
    while (seen.at(-1) !== null) seen.push(nextWatchlistSort(seen.at(-1) ?? null));

    expect(seen).toEqual([...SORTS, null]);
  });
});
