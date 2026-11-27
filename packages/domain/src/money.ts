// Every amount in the domain is an integer in its smallest unit, so arithmetic is exact and the
// books balance to the cent. Floats only exist at the edges (display, user input).
export type Cents = number;
export type Micros = number;
export type Ticks = number;
export type Bps = number;

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
  return divide(exact, NOTIONAL_SCALE, rounding);
}

// Buys debit with `up` and sells credit with `down`, so rounding never creates money.
export function notionalCents(qty: Micros, price: Ticks, rounding: Rounding): Cents {
  return exactToCents(exactNotional(qty, price), rounding);
}

export function sharesForCents(amount: Cents, price: Ticks, rounding: Rounding = 'down'): Micros {
  return divide(BigInt(amount) * NOTIONAL_SCALE, BigInt(price), rounding);
}

export function scaleBps(value: number, bps: Bps, rounding: Rounding): number {
  return divide(BigInt(value) * BigInt(BPS_PER_UNIT + bps), BigInt(BPS_PER_UNIT), rounding);
}

// The share of `whole` that `part` makes, in basis points (0 when there is no whole).
export function ratioBps(part: number, whole: number): Bps {
  if (whole === 0) return 0;
  return divide(BigInt(part) * BigInt(BPS_PER_UNIT), BigInt(whole), 'nearest');
}

export function changeBps(from: number, to: number): Bps {
  return ratioBps(to - from, from);
}

// Shifting the decimal point in the string form avoids float error: 1.005 → 101 cents, not 100.
function scaleDecimal(value: number, digits: number): number {
  const shifted = Number(`${String(value)}e${String(digits)}`);
  return Math.round(Number.isFinite(shifted) ? shifted : value * 10 ** digits);
}

export const dollarsToCents = (dollars: number): Cents => scaleDecimal(dollars, 2);
export const dollarsToTicks = (dollars: number): Ticks => scaleDecimal(dollars, 4);
export const sharesToMicros = (shares: number): Micros => scaleDecimal(shares, 6);
export const centsToDollars = (cents: Cents): number => cents / CENTS_PER_DOLLAR;
export const ticksToDollars = (ticks: Ticks): number => ticks / TICKS_PER_DOLLAR;
export const microsToShares = (micros: Micros): number => micros / MICROS_PER_SHARE;
export const ticksToCents = (ticks: Ticks, rounding: Rounding): Cents =>
  divide(BigInt(ticks), BigInt(TICKS_PER_CENT), rounding);

// Keypad and input text → integer units; null when the text is not a valid amount at that precision.
function parseDecimal(text: string, digits: number): number | null {
  const trimmed = text.trim();
  if (!new RegExp(`^\\d+(\\.\\d{0,${String(digits)}})?$`).test(trimmed)) return null;
  const [whole, fraction = ''] = trimmed.split('.') as [string, string?];
  const value = Number(whole) * 10 ** digits + Number(fraction.padEnd(digits, '0'));
  return Number.isSafeInteger(value) ? value : null;
}

export const parseCents = (text: string): Cents | null => parseDecimal(text, 2);
export const parseTicks = (text: string): Ticks | null => parseDecimal(text, 4);
export const parseMicros = (text: string): Micros | null => parseDecimal(text, 6);
