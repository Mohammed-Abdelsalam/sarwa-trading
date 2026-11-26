import { type StockWithQuote } from '@sarwa/contracts';

import { averageChangePct, filterAndSort, keyStats, nextSort, SORTS } from '../src/markets';
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
