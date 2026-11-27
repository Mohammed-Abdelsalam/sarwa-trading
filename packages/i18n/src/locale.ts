export const LOCALES = ['en', 'ar'] as const;
export type Locale = (typeof LOCALES)[number];

// Western (latn) or Arabic-Indic (arab) digits: a user setting, independent of the language.
export const DIGITS = ['latn', 'arab'] as const;
export type Digits = (typeof DIGITS)[number];

const RTL_LOCALES: readonly Locale[] = ['ar'];

export function isRtl(locale: Locale): boolean {
  return RTL_LOCALES.includes(locale);
}

// The design keeps Western digits by default in Arabic too (X-RTL); Arabic-Indic is a user setting.
export const DEFAULT_DIGITS: Digits = 'latn';

export const INTL_LOCALE: Record<Locale, string> = { en: 'en-US', ar: 'ar-EG' };

export type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';
export type PluralForms = Partial<Record<PluralCategory, string>> & { other: string };

// CLDR cardinal rules, written out because Hermes (React Native on Android) has no Intl.PluralRules.
const pluralRules: Record<Locale, (count: number) => PluralCategory> = {
  en: (n) => (n === 1 ? 'one' : 'other'),
  ar: (n) => {
    if (!Number.isInteger(n)) return 'other';
    const mod100 = Math.abs(n) % 100;
    if (n === 0) return 'zero';
    if (n === 1) return 'one';
    if (n === 2) return 'two';
    if (mod100 >= 3 && mod100 <= 10) return 'few';
    if (mod100 >= 11) return 'many';
    return 'other';
  },
};

export function plural(locale: Locale, count: number, forms: PluralForms): string {
  return forms[pluralRules[locale](count)] ?? forms.other;
}
