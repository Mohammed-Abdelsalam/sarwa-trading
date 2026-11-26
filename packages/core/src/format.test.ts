import {
  changePct,
  direction,
  formatChange,
  formatMarketCap,
  formatPct,
  formatPrice,
} from './format';

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
