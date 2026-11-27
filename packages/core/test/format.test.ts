import {
  changePct,
  direction,
  formatCandleTime,
  formatChange,
  formatMarketCap,
  formatPct,
  formatPrice,
  formatCandleDate,
  formatListPrice,
  formatMarketTime,
  formatQuoteLabel,
  formatStockLabel,
} from '../src/format';

describe('formatters', () => {
  it('formats prices as USD with two decimals', () => {
    expect(formatPrice(231.48)).toBe('$231.48');
    expect(formatPrice(1234.5)).toBe('$1,234.50');
  });

  it('always shows a sign so direction never relies on colour alone', () => {
    expect(formatPct(1.2449)).toBe('+1.24%');
    expect(formatPct(-0.87)).toBe('−0.87%');
    expect(formatPct(0.001)).toBe('0.00%');
    expect(formatChange(2.84)).toBe('+2.84');
    expect(formatChange(-1.02)).toBe('−1.02');
  });

  it('formats market cap compactly', () => {
    expect(formatMarketCap(3.52e12)).toBe('$3.52T');
    expect(formatMarketCap(796.4e9)).toBe('$796.4B');
  });
});

describe('changePct / direction', () => {
  it('derives the change from the previous close', () => {
    expect(changePct({ price: 110, prevClose: 100 })).toBeCloseTo(10);
  });

  it('treats sub-cent moves as flat', () => {
    expect(direction(0.004)).toBe('flat');
    expect(direction(0.01)).toBe('up');
    expect(direction(-0.01)).toBe('down');
  });
});

describe('formatCandleTime', () => {
  it('labels the chart axis by period', () => {
    const t = new Date(2026, 2, 14, 15, 30).getTime();
    expect(formatCandleTime(t, '1D')).toBe('3:30 PM');
    expect(formatCandleTime(t, '1M')).toBe('Mar 14');
    expect(formatCandleTime(t, 'ALL')).toBe('2026');
  });
});

describe('formatQuoteLabel', () => {
  it('reads the price and day change in words for screen readers', () => {
    expect(formatQuoteLabel({ price: 110, prevClose: 100 })).toBe('$110.00, up 10.00% today');
    expect(formatQuoteLabel({ price: 95, prevClose: 100 })).toBe('$95.00, down 5.00% today');
    expect(formatQuoteLabel({ price: 100, prevClose: 100 })).toBe('$100.00, unchanged today');
  });
});

describe('formatCandleDate', () => {
  it('dates the crosshair point at the precision of the period', () => {
    const t = new Date(2026, 10, 25, 14, 41).getTime();
    expect(formatCandleDate(t, '1D')).toBe('Nov 25 · 2:41 PM');
    expect(formatCandleDate(t, '1W')).toBe('Wed, Nov 25');
    expect(formatCandleDate(t, '1M')).toBe('Nov 25, 2026');
    expect(formatCandleDate(t, 'ALL')).toBe('Nov 2026');
  });
});

describe('formatMarketTime', () => {
  it('shows the time in New York with an ET suffix', () => {
    expect(formatMarketTime(Date.UTC(2026, 10, 26, 19, 41))).toBe('2:41 PM ET');
  });
});

describe('formatListPrice', () => {
  it('drops cents from six-figure prices so the list column never truncates', () => {
    expect(formatListPrice(712_340.12)).toBe('$712,340');
    expect(formatListPrice(231.48)).toBe('$231.48');
  });
});

describe('formatStockLabel', () => {
  it('reads one row as a single sentence for screen readers', () => {
    expect(
      formatStockLabel({
        symbol: 'AAPL',
        name: 'Apple Inc.',
        quote: { price: 231.48, prevClose: 228.65 },
        watched: true,
      }),
    ).toBe('Apple Inc., AAPL. $231.48. Up 1.24% today. In watchlist.');
  });
});
