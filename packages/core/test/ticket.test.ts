import { cents } from '@sarwa/domain';

import { applyKeypadKey, centsToText, fieldErrors } from '../src/ticket';

describe('applyKeypadKey', () => {
  it('appends digits and removes the last character on backspace', () => {
    expect(applyKeypadKey('12', '3', 2)).toBe('123');
    expect(applyKeypadKey('123', 'backspace', 2)).toBe('12');
    expect(applyKeypadKey('', 'backspace', 2)).toBe('');
  });

  it('does not allow leading zeros', () => {
    expect(applyKeypadKey('0', '5', 2)).toBe('5');
    expect(applyKeypadKey('0', '0', 2)).toBe('0');
  });

  it('adds one decimal point, starting with 0 on an empty field', () => {
    expect(applyKeypadKey('', '.', 2)).toBe('0.');
    expect(applyKeypadKey('4', '.', 2)).toBe('4.');
    expect(applyKeypadKey('4.5', '.', 2)).toBe('4.5');
  });

  it('respects the maximum number of decimals', () => {
    expect(applyKeypadKey('4.55', '1', 2)).toBe('4.55');
    expect(applyKeypadKey('4.5', '1', 2)).toBe('4.51');
    expect(applyKeypadKey('4', '.', 0)).toBe('4');
  });
});

describe('centsToText', () => {
  it('drops trailing zeros so the field shows what a person would type', () => {
    expect(centsToText(cents(10_000))).toBe('100');
    expect(centsToText(cents(123_450))).toBe('1234.5');
  });
});

describe('fieldErrors', () => {
  it('keeps the first issue for each field and skips issues without one', () => {
    expect(
      fieldErrors([
        { code: 'MARKET_PAUSED' },
        { code: 'MIN_NOTIONAL', field: 'size', minCents: cents(100) },
        {
          code: 'INSUFFICIENT_FUNDS',
          field: 'size',
          requiredCents: cents(1),
          availableCents: cents(0),
        },
      ]),
    ).toEqual({ size: { code: 'MIN_NOTIONAL', field: 'size', minCents: 100 } });
  });
});
