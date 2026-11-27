import {
  absolute,
  bps,
  cents,
  centsToDollars,
  changeBps,
  divide,
  dollarsToCents,
  dollarsToTicks,
  micros,
  microsToShares,
  negate,
  notionalCents,
  parseCents,
  parseMicros,
  parseTicks,
  percentToBps,
  ratioBps,
  scaleBps,
  sharesForCents,
  sharesToMicros,
  ticks,
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

describe('unit constructors', () => {
  it('brand an integer without changing it', () => {
    expect(cents(-12)).toBe(-12);
    expect(ticks(0)).toBe(0);
    expect(micros(1_000_000)).toBe(1_000_000);
    expect(bps(500)).toBe(500);
    expect(negate(cents(250))).toBe(-250);
  });

  it.each([1.5, NaN, Infinity, 2 ** 53])('reject %p', (value) => {
    expect(() => cents(value)).toThrow(RangeError);
  });
});

describe('notionalCents', () => {
  it('rounds a buy up and a sell down', () => {
    const oneShare = micros(1_000_000);
    const price = ticks(1_500_001);

    expect(notionalCents(oneShare, price, 'up')).toBe(15_001);
    expect(notionalCents(oneShare, price, 'down')).toBe(15_000);
  });

  it('stays exact when qty × price is far beyond 2^53', () => {
    const millionShares = micros(1_000_000_000_000);
    const price = ticks(99_999_999);

    expect(notionalCents(millionShares, price, 'up')).toBe(999_999_990_000);
  });
});

describe('sharesForCents', () => {
  it('buys only whole micros for $1 at $3,000 a share by default', () => {
    expect(sharesForCents(cents(100), ticks(30_000_000))).toBe(333);
    expect(sharesForCents(cents(100), ticks(30_000_000), 'up')).toBe(334);
  });
});

describe('scaleBps', () => {
  it('applies basis points in either direction with the given rounding', () => {
    expect(scaleBps(ticks(10_000), bps(5), 'up')).toBe(10_005);
    expect(scaleBps(ticks(10_001), bps(5), 'up')).toBe(10_007);
    expect(scaleBps(ticks(10_001), bps(5), 'down')).toBe(10_006);
    expect(scaleBps(ticks(10_000), negate(bps(500)), 'down')).toBe(9_500);
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
    expect(centsToDollars(cents(12_345))).toBe(123.45);
    expect(ticksToDollars(ticks(1_501_234))).toBe(150.1234);
    expect(microsToShares(micros(1_500_000))).toBe(1.5);
  });

  it('converts a float percent to basis points', () => {
    expect(percentToBps(1.2345)).toBe(123);
    expect(percentToBps(-5.25)).toBe(-525);
    expect(absolute(percentToBps(-5.25))).toBe(525);
  });

  it('converts ticks to cents with the given rounding', () => {
    expect(ticksToCents(ticks(1_501_234), 'up')).toBe(15_013);
    expect(ticksToCents(ticks(1_501_234), 'down')).toBe(15_012);
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
