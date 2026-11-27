import {
  changePct,
  direction,
  formatChange,
  formatListPrice,
  formatMarketCap,
  formatPct,
  formatPrice,
  formatQuoteLabel,
  formatStockLabel,
  shareStockMessage,
} from '../src/format';
import { localized } from './utils';

const en = localized();
const ar = localized('ar', 'arab');
const isolated = (text: string) => `⁦${text}⁩`;

describe('formatters', () => {
  it('formats prices as USD with two decimals', () => {
    expect(formatPrice(en.f, 231.48)).toBe('$231.48');
    expect(formatPrice(en.f, 1234.5)).toBe('$1,234.50');
  });

  it('always shows a sign so direction never relies on colour alone', () => {
    expect(formatPct(en.f, 1.2449)).toBe('+1.24%');
    expect(formatPct(en.f, -0.87)).toBe('−0.87%');
    expect(formatPct(en.f, 0.001)).toBe('0.00%');
    expect(formatPct(en.f, -0.001)).toBe('0.00%');
    expect(formatChange(en.f, 2.84)).toBe('+$2.84');
    expect(formatChange(en.f, -1.02)).toBe('−$1.02');
  });

  it('formats market cap compactly', () => {
    expect(formatMarketCap(en.f, 3.52e12)).toBe('$3.52T');
    expect(formatMarketCap(en.f, 796.4e9)).toBe('$796.4B');
  });

  it('follows the Arabic locale and digit setting', () => {
    expect(formatPrice(ar.f, 231.48)).toBe(isolated('$٢٣١٫٤٨'));
    expect(formatPct(ar.f, 1.24)).toBe(isolated('+١٫٢٤٪'));
    expect(formatListPrice(ar.f, 712_340.12)).toBe(isolated('$٧١٢٬٣٤٠'));
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

describe('formatQuoteLabel', () => {
  it('reads the price and day change in words for screen readers', () => {
    expect(formatQuoteLabel(en, { price: 110, prevClose: 100 })).toBe('$110.00, up 10.00% today');
    expect(formatQuoteLabel(en, { price: 95, prevClose: 100 })).toBe('$95.00, down 5.00% today');
    expect(formatQuoteLabel(en, { price: 100, prevClose: 100 })).toBe('$100.00, unchanged today');
  });

  it('reads it in Arabic', () => {
    expect(formatQuoteLabel(ar, { price: 110, prevClose: 100 })).toBe(
      `${isolated('$١١٠٫٠٠')}، ارتفع ${isolated('١٠٫٠٠٪')} اليوم`,
    );
  });
});

describe('formatListPrice', () => {
  it('drops cents from six-figure prices so the list column never truncates', () => {
    expect(formatListPrice(en.f, 712_340.12)).toBe('$712,340');
    expect(formatListPrice(en.f, 231.48)).toBe('$231.48');
  });
});

describe('formatStockLabel', () => {
  it('reads one row as a single sentence for screen readers', () => {
    expect(
      formatStockLabel(en, {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        quote: { price: 231.48, prevClose: 228.65 },
        watched: true,
      }),
    ).toBe('Apple Inc., AAPL. $231.48. Up 1.24% today. In watchlist.');
    expect(
      formatStockLabel(en, {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        quote: { price: 100, prevClose: 100 },
      }),
    ).toBe('Apple Inc., AAPL. $100.00. Unchanged today.');
  });
});

describe('shareStockMessage', () => {
  it('sums up the stock and its move today', () => {
    expect(
      shareStockMessage(en, {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        quote: { price: 192.3, prevClose: 189.94 },
      }),
    ).toBe('AAPL · Apple Inc. $192.30, +1.24% today');
  });
});
