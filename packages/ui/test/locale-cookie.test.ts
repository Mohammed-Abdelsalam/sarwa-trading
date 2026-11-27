/**
 * @jest-environment-options {"url": "https://mini-trading.example/"}
 */
import { readCookie, readLocalePreferences, writePreferenceCookie } from '../src/lib/locale-cookie';

describe('preference cookie', () => {
  it('is marked secure when the site is served over https', () => {
    const set = jest.spyOn(document, 'cookie', 'set');

    writePreferenceCookie('sarwa.locale', 'ar');

    expect(set).toHaveBeenCalledWith(expect.stringMatching(/^sarwa\.locale=ar; .*; secure$/));
    set.mockRestore();
  });

  it('writes only the preference cookies', () => {
    writePreferenceCookie('sarwa_csrf', 'forged');

    expect(readCookie('sarwa_csrf')).toBeNull();
  });

  it('reads one cookie by name', () => {
    document.cookie = 'sarwa.locale=ar';

    expect(readCookie('sarwa.locale')).toBe('ar');
    expect(readCookie('missing')).toBeNull();
  });

  it('falls back to English and Western digits for a missing or unknown value', () => {
    const cookies: Record<string, string> = { 'sarwa.locale': 'ar', 'sarwa.digits': 'arab' };

    expect(readLocalePreferences((name) => cookies[name])).toEqual({
      locale: 'ar',
      digits: 'arab',
    });
    expect(readLocalePreferences((name) => (name === 'sarwa.locale' ? 'fr' : undefined))).toEqual({
      locale: 'en',
      digits: 'latn',
    });
  });
});
