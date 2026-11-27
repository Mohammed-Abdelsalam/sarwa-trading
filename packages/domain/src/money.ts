// Every amount in the domain is an integer in its smallest unit, so arithmetic is exact and the
// books balance to the cent. Floats only exist at the edges (display, user input).
// Each unit is a branded number: passing cents where ticks are expected fails to compile, at no
// runtime cost. Arithmetic on them gives a plain number, re-branded through the constructors below.
export type Cents = number & { readonly __unit: 'cents' };
export type Micros = number & { readonly __unit: 'micros' };
export type Ticks = number & { readonly __unit: 'ticks' };
export type Bps = number & { readonly __unit: 'bps' };

function integer(value: number): number {
  if (!Number.isSafeInteger(value)) throw new RangeError(`Not an integer amount: ${String(value)}`);
  return value;
}

export const cents = (value: number) => integer(value) as Cents;
export const micros = (value: number) => integer(value) as Micros;
export const ticks = (value: number) => integer(value) as Ticks;
export const bps = (value: number) => integer(value) as Bps;
// The same amount with the opposite sign, keeping its unit.
export const negate = <Unit extends Cents | Micros | Ticks | Bps>(value: Unit) =>
  (0 - value) as Unit;

export const CENTS_PER_DOLLAR = 100;
export const MICROS_PER_SHARE = 1_000_000;
export const TICKS_PER_DOLLAR = 10_000;
export const BPS_PER_UNIT = 10_000;

const TICKS_PER_CENT = TICKS_PER_DOLLAR / CENTS_PER_DOLLAR;
// qty (micros) × price (ticks) / NOTIONAL_SCALE = cents.
const NOTIONAL_SCALE = BigInt(MICROS_PER_SHARE * TICKS_PER_CENT);

export type Rounding = 'down' | 'up' | 'nearest';

// The single rounding helper. BigInt keeps qty × price exact far past 2^53; `down` and `up` are
// floor and ceil, `nearest` rounds half away from zero.
export function divide(numerator: bigint, denominator: bigint, rounding: Rounding): number {
  if (denominator === 0n) throw new RangeError('Division by zero');
  const negative = numerator < 0n !== denominator < 0n;
  const n = numerator < 0n ? -numerator : numerator;
  const d = denominator < 0n ? -denominator : denominator;
  let quotient = n / d;
  const remainder = n % d;
  if (remainder !== 0n) {
    const roundAway =
      rounding === 'nearest' ? 2n * remainder >= d : (rounding === 'up') !== negative;
    if (roundAway) quotient += 1n;
  }
  const result = Number(negative ? -quotient : quotient);
  if (!Number.isSafeInteger(result))
    throw new RangeError('Amount is out of the safe integer range');
  return result;
}

// The exact value of qty × price before rounding to cents (units of 1/10^8 cent). Orders that fill
// in parts add these up, so many partial fills round once in total instead of once each.
export function exactNotional(qty: Micros, price: Ticks): bigint {
  return BigInt(qty) * BigInt(price);
}

export function exactToCents(exact: bigint, rounding: Rounding): Cents {
  return divide(exact, NOTIONAL_SCALE, rounding) as Cents;
}

// Buys debit with `up` and sells credit with `down`, so rounding never creates money.
export function notionalCents(qty: Micros, price: Ticks, rounding: Rounding): Cents {
  return exactToCents(exactNotional(qty, price), rounding);
}

export function sharesForCents(amount: Cents, price: Ticks, rounding: Rounding = 'down'): Micros {
  return divide(BigInt(amount) * NOTIONAL_SCALE, BigInt(price), rounding) as Micros;
}

// A price moved by a signed number of basis points.
export function scaleBps(price: Ticks, offset: Bps, rounding: Rounding): Ticks {
  return divide(
    BigInt(price) * BigInt(BPS_PER_UNIT + offset),
    BigInt(BPS_PER_UNIT),
    rounding,
  ) as Ticks;
}

// The share of `whole` that `part` makes, in basis points (0 when there is no whole). Both sides
// share one unit, so a ratio of cents to micros does not compile.
export function ratioBps<Unit extends number>(part: Unit, whole: Unit): Bps {
  if (whole === 0) return 0 as Bps;
  return divide(BigInt(part) * BigInt(BPS_PER_UNIT), BigInt(whole), 'nearest') as Bps;
}

export function changeBps<Unit extends number>(from: Unit, to: Unit): Bps {
  return ratioBps(to - from, from);
}

// Shifting the decimal point in the string form avoids float error: 1.005 → 101 cents, not 100.
function scaleDecimal(value: number, digits: number): number {
  const shifted = Number(`${String(value)}e${String(digits)}`);
  return Math.round(Number.isFinite(shifted) ? shifted : value * 10 ** digits);
}

export const dollarsToCents = (dollars: number) => scaleDecimal(dollars, 2) as Cents;
export const dollarsToTicks = (dollars: number) => scaleDecimal(dollars, 4) as Ticks;
export const sharesToMicros = (shares: number) => scaleDecimal(shares, 6) as Micros;
export const centsToDollars = (amount: Cents): number => amount / CENTS_PER_DOLLAR;
export const ticksToDollars = (price: Ticks): number => price / TICKS_PER_DOLLAR;
export const microsToShares = (qty: Micros): number => qty / MICROS_PER_SHARE;
// The same amount without its sign, keeping its unit.
export const absolute = <Unit extends Cents | Micros | Ticks | Bps>(value: Unit) =>
  Math.abs(value) as Unit;
// A percent as a float (quotes, charts) → basis points, rounded like the display.
export const percentToBps = (percent: number) => Math.round(percent * 100) as Bps;
export const ticksToCents = (price: Ticks, rounding: Rounding) =>
  divide(BigInt(price), BigInt(TICKS_PER_CENT), rounding) as Cents;

// Keypad and input text → integer units; null when the text is not a valid amount at that precision.
function parseDecimal(text: string, digits: number): number | null {
  const trimmed = text.trim();
  if (!new RegExp(`^\\d+(\\.\\d{0,${String(digits)}})?$`).test(trimmed)) return null;
  const [whole, fraction = ''] = trimmed.split('.') as [string, string?];
  const value = Number(whole) * 10 ** digits + Number(fraction.padEnd(digits, '0'));
  return Number.isSafeInteger(value) ? value : null;
}

export const parseCents = (text: string) => parseDecimal(text, 2) as Cents | null;
export const parseTicks = (text: string) => parseDecimal(text, 4) as Ticks | null;
export const parseMicros = (text: string) => parseDecimal(text, 6) as Micros | null;
