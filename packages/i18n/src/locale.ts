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

export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

const pluralRules = {
  en: new Intl.PluralRules('en'),
  ar: new Intl.PluralRules('ar'),
} satisfies Record<Locale, Intl.PluralRules>;

export function plural(locale: Locale, count: number, forms: PluralForms): string {
  return forms[pluralRules[locale].select(count)] ?? forms.other;
}
