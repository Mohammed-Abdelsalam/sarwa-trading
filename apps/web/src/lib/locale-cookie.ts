import { DEFAULT_DIGITS, type Digits, DIGITS, type Locale, LOCALES } from '@sarwa/core/server';

// Language and digits are mirrored into cookies so the server renders the same language the client
// will, instead of English first and a hydration mismatch after.
export const PREFERENCE_COOKIES = { locale: 'sarwa.locale', digits: 'sarwa.digits' } as const;

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

export interface LocalePreferences {
  locale: Locale;
  digits: Digits;
}

export function readLocalePreferences(
  get: (name: string) => string | undefined,
): LocalePreferences {
  const locale = get(PREFERENCE_COOKIES.locale);
  const digits = get(PREFERENCE_COOKIES.digits);
  return {
    locale: LOCALES.find((option) => option === locale) ?? 'en',
    digits: DIGITS.find((option) => option === digits) ?? DEFAULT_DIGITS,
  };
}

export function writePreferenceCookie(key: string, value: string): void {
  if (!Object.values<string>(PREFERENCE_COOKIES).includes(key)) return;
  document.cookie = `${key}=${encodeURIComponent(value)}; path=/; max-age=${String(ONE_YEAR_SECONDS)}; samesite=lax`;
}
