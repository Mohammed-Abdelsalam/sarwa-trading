import {
  ADMIN_REASON_LENGTH,
  AUTH_FIELD_ERRORS,
  checkPassword,
  NAME_MAX_LENGTH,
  needsNumberOrSymbol,
  PASSWORD_ISSUES,
  PASSWORD_POLICY,
  passwordStrength,
  SUSPENSION_CATEGORIES,
} from '../src/accounts';

describe('checkPassword', () => {
  it('accepts a long, uncommon password', () => {
    expect(checkPassword('violet-harbor-42')).toEqual([]);
  });

  it('needs at least the minimum length', () => {
    expect(checkPassword('a'.repeat(PASSWORD_POLICY.minLength - 1))).toEqual(['TOO_SHORT']);
    expect(checkPassword('x7#kq9Lm')).toEqual([]);
  });

  it('caps the length so hashing stays cheap', () => {
    expect(checkPassword('a'.repeat(PASSWORD_POLICY.maxLength + 1))).toEqual(['TOO_LONG']);
  });

  it('rejects common passwords whatever their case or padding', () => {
    expect(checkPassword('password123')).toEqual(['COMMON']);
    expect(checkPassword('PassWord123')).toEqual(['COMMON']);
    expect(checkPassword(' qwertyuiop ')).toEqual(['COMMON']);
  });

  it('reports every issue at once', () => {
    expect(checkPassword('')).toEqual(['TOO_SHORT']);
  });
});

describe('passwordStrength', () => {
  it.each([
    ['', 0],
    ['short', 1],
    ['password1', 1],
    ['plainwords', 2],
    ['Plainwords9', 3],
    ['plainwordsplainword', 4],
    ['Correct-horse9', 4],
  ] as const)('scores %j as %i', (password, score) => {
    expect(passwordStrength(password)).toBe(score);
  });

  it('never rates a password the policy refuses above weak', () => {
    expect(passwordStrength('Qwertyuiop')).toBe(1);
  });
});

describe('needsNumberOrSymbol', () => {
  it('asks for a number or symbol only when there is none', () => {
    expect(needsNumberOrSymbol('plainwords')).toBe(true);
    expect(needsNumberOrSymbol('plain words')).toBe(false);
    expect(needsNumberOrSymbol('plainwords1')).toBe(false);
  });
});

describe('account vocabularies', () => {
  it('lists each code once', () => {
    expect(new Set(AUTH_FIELD_ERRORS).size).toBe(AUTH_FIELD_ERRORS.length);
    expect(SUSPENSION_CATEGORIES).toEqual(['abuse', 'fraud', 'terms', 'customer_request', 'other']);
  });

  it('names every password issue checkPassword can report', () => {
    const reported = new Set([
      ...checkPassword(''),
      ...checkPassword('x'.repeat(PASSWORD_POLICY.maxLength + 1)),
      ...checkPassword('password123'),
    ]);
    expect([...reported].sort()).toEqual([...PASSWORD_ISSUES].sort());
  });

  it('keeps admin reasons and names within the limits the forms show', () => {
    expect(ADMIN_REASON_LENGTH).toEqual({ min: 10, max: 280 });
    expect(NAME_MAX_LENGTH).toBe(80);
  });
});
