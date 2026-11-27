import { type StockWithQuote } from '@sarwa/contracts';

import {
  averageChangePct,
  filterAndSort,
  keyStats,
  nextSort,
  nextWatchlistSort,
  rangePosition,
  sectorFilterLabel,
  similarStocks,
  sortByColumn,
  SORTS,
  sortStocks,
} from '../src/markets';
import { makeQuote } from './utils';

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
  it('formats the stats grid, with a dash for a missing P/E', () => {
    const quote = makeQuote({ open: 229.1, volume: 52_300_000 });
    const stats = keyStats(
      {
        stock: {
          symbol: 'AAPL',
          name: 'Apple',
          sector: 'tech',
          exchange: 'NASDAQ',
          currency: 'USD',
        },
        quote,
        stats: {
          marketCap: 3_500_000_000_000,
          peRatio: null,
          week52High: 260,
          week52Low: 160,
          avgVolume: 1,
        },
      },
      quote,
    );
    expect(stats).toContainEqual({ label: 'P/E (TTM)', value: '—' });
    expect(stats).toContainEqual({ label: 'Market cap', value: '$3.5T' });
    expect(stats).toContainEqual({ label: 'Volume', value: '52.3M' });
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
    expect(sectorFilterLabel('all')).toBe('All');
    expect(sectorFilterLabel('fin')).toBe('Finance');
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
