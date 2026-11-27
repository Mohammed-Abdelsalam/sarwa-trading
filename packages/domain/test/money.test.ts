import {
  centsToDollars,
  changeBps,
  divide,
  dollarsToCents,
  dollarsToTicks,
  microsToShares,
  notionalCents,
  parseCents,
  parseMicros,
  parseTicks,
  ratioBps,
  scaleBps,
  sharesForCents,
  sharesToMicros,
  ticksToCents,
  ticksToDollars,
} from '../src/money';

describe('divide', () => {
  it.each([
    [7n, 2n, 'down', 3],
    [7n, 2n, 'up', 4],
    [7n, 2n, 'nearest', 4],
    [7n, 3n, 'nearest', 2],
    [-7n, 2n, 'down', -4],
    [-7n, 2n, 'up', -3],
    [-7n, 2n, 'nearest', -4],
    [7n, -2n, 'down', -4],
    [-7n, -2n, 'up', 4],
    [6n, 3n, 'up', 2],
  ] as const)(
    'divides %p by %p rounding %s to %p',
    (numerator, denominator, rounding, expected) => {
      expect(divide(numerator, denominator, rounding)).toBe(expected);
    },
  );

  it('throws when dividing by zero', () => {
    expect(() => divide(1n, 0n, 'down')).toThrow(RangeError);
  });

  it('throws when the result is beyond the safe integer range', () => {
    expect(() => divide(2n ** 60n, 1n, 'down')).toThrow('safe integer');
  });
});

describe('notionalCents', () => {
  it('rounds a buy up and a sell down', () => {
    const oneShare = 1_000_000;
    const price = 1_500_001;

    expect(notionalCents(oneShare, price, 'up')).toBe(15_001);
    expect(notionalCents(oneShare, price, 'down')).toBe(15_000);
  });

  it('stays exact when qty × price is far beyond 2^53', () => {
    const millionShares = 1_000_000_000_000;
    const price = 99_999_999;

    expect(notionalCents(millionShares, price, 'up')).toBe(999_999_990_000);
  });
});

describe('sharesForCents', () => {
  it('buys only whole micros for $1 at $3,000 a share by default', () => {
    expect(sharesForCents(100, 30_000_000)).toBe(333);
    expect(sharesForCents(100, 30_000_000, 'up')).toBe(334);
  });
});

describe('scaleBps', () => {
  it('applies basis points in either direction with the given rounding', () => {
    expect(scaleBps(10_000, 5, 'up')).toBe(10_005);
    expect(scaleBps(10_001, 5, 'up')).toBe(10_007);
    expect(scaleBps(10_001, 5, 'down')).toBe(10_006);
    expect(scaleBps(10_000, -500, 'down')).toBe(9_500);
  });
});

describe('ratioBps and changeBps', () => {
  it('rounds the ratio to the nearest basis point', () => {
    expect(ratioBps(1, 3)).toBe(3_333);
    expect(ratioBps(2, 3)).toBe(6_667);
  });

  it('returns 0 when there is no whole', () => {
    expect(ratioBps(5, 0)).toBe(0);
  });

  it('signs the change from one value to another', () => {
    expect(changeBps(200, 210)).toBe(500);
    expect(changeBps(200, 190)).toBe(-500);
  });
});

describe('conversions', () => {
  it('converts dollars to cents without float error', () => {
    expect(dollarsToCents(1.005)).toBe(101);
    expect(dollarsToCents(0.1 + 0.2)).toBe(30);
  });

  it('converts values written in exponent notation', () => {
    expect(dollarsToCents(1e21)).toBe(1e23);
    expect(sharesToMicros(4e-7)).toBe(0);
  });

  it('converts between display units and integer units', () => {
    expect(dollarsToTicks(150.1234)).toBe(1_501_234);
    expect(sharesToMicros(1.5)).toBe(1_500_000);
    expect(centsToDollars(12_345)).toBe(123.45);
    expect(ticksToDollars(1_501_234)).toBe(150.1234);
    expect(microsToShares(1_500_000)).toBe(1.5);
  });

  it('converts ticks to cents with the given rounding', () => {
    expect(ticksToCents(1_501_234, 'up')).toBe(15_013);
    expect(ticksToCents(1_501_234, 'down')).toBe(15_012);
  });
});

describe('parsing input text', () => {
  it.each([
    ['12.34', 1_234],
    ['12', 1_200],
    ['12.', 1_200],
    [' 7.5 ', 750],
    ['0', 0],
  ])('parses %p as %p cents', (text, expected) => {
    expect(parseCents(text)).toBe(expected);
  });

  it.each(['', '.5', '12.345', 'abc', '-1', '1,000', '1e3', '99999999999999999'])(
    'rejects %p',
    (text) => {
      expect(parseCents(text)).toBeNull();
    },
  );

  it('parses ticks and micros at their own precision', () => {
    expect(parseTicks('1.2345')).toBe(12_345);
    expect(parseTicks('1.23456')).toBeNull();
    expect(parseMicros('0.000001')).toBe(1);
    expect(parseMicros('0.0000001')).toBeNull();
  });
});
