import {
  ADMIN_REASON_LENGTH,
  checkPassword,
  DELETE_CONFIRM,
  NAME_MAX_LENGTH,
  needsNumberOrSymbol,
  PASSWORD_POLICY,
  passwordStrength,
  RESET_CONFIRM,
  SUSPENSION_CATEGORIES,
} from '../src/pure';

describe('account rules for apps', () => {
  it('re-exports the password meter and the form limits apps render', () => {
    expect(checkPassword('short')).toEqual(['TOO_SHORT']);
    expect(passwordStrength('a much longer phrase')).toBe(4);
    expect(needsNumberOrSymbol('letters')).toBe(true);
    expect(PASSWORD_POLICY.minLength).toBe(8);
    expect(NAME_MAX_LENGTH).toBe(80);
    expect(ADMIN_REASON_LENGTH).toEqual({ min: 10, max: 280 });
    expect(SUSPENSION_CATEGORIES).toContain('abuse');
    expect([DELETE_CONFIRM, RESET_CONFIRM]).toEqual(['DELETE', 'RESET']);
  });
});
