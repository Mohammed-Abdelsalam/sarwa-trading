import { micros } from '@sarwa/domain';

import { createFormatter, DEFAULT_DIGITS, getMessages, isRtl, LOCALES, plural } from '../src';

describe('locales', () => {
  it('lists English and Arabic', () => {
    expect(LOCALES).toEqual(['en', 'ar']);
  });

  it('reports Arabic as right-to-left and English as left-to-right', () => {
    expect(isRtl('ar')).toBe(true);
    expect(isRtl('en')).toBe(false);
  });

  it('uses Western digits by default in both locales, as the design does', () => {
    expect(DEFAULT_DIGITS).toBe('latn');
    expect(createFormatter({ locale: 'ar' }).digits).toBe('latn');
    expect(createFormatter({ locale: 'en' }).digits).toBe('latn');
  });

  it('switches Arabic to Arabic-Indic digits when the user asks for them', () => {
    expect(createFormatter({ locale: 'ar', digits: 'arab' }).number(231)).toBe('٢٣١');
  });

  it('lets the user override the default digits', () => {
    const f = createFormatter({ locale: 'ar', digits: 'latn' });

    expect(f.digits).toBe('latn');
    expect(f.shares(micros(42_000_000))).toBe('42');
  });
});

describe('getMessages', () => {
  it('returns the catalog of the requested locale', () => {
    expect(getMessages('en').common.buy).toBe('Buy');
    expect(getMessages('ar').common.buy).toBe('شراء');
  });
});

describe('plural', () => {
  it('picks the Arabic dual and few forms', () => {
    const forms = { one: 'دقيقة', two: 'دقيقتين', few: 'دقائق', other: 'دقيقة+' };

    expect(plural('ar', 1, forms)).toBe('دقيقة');
    expect(plural('ar', 2, forms)).toBe('دقيقتين');
    expect(plural('ar', 5, forms)).toBe('دقائق');
    expect(plural('ar', 11, forms)).toBe('دقيقة+');
  });

  it('picks the same category as Intl.PluralRules, which Hermes lacks', () => {
    const forms = {
      zero: 'zero',
      one: 'one',
      two: 'two',
      few: 'few',
      many: 'many',
      other: 'other',
    };
    const counts = [...Array.from({ length: 251 }, (_, n) => n), 1001, 1.5, 2.25, 0.5];

    for (const locale of LOCALES) {
      const rules = new Intl.PluralRules(locale);
      for (const count of counts) {
        expect(plural(locale, count, forms)).toBe(rules.select(count));
      }
    }
  });

  it('works when the runtime has no Intl.PluralRules', () => {
    const original = Intl.PluralRules;
    Reflect.deleteProperty(Intl, 'PluralRules');
    try {
      jest.isolateModules(() => {
        const { plural: isolated } = jest.requireActual<{ plural: typeof plural }>('../src');
        expect(isolated('en', 2, { one: 'order', other: 'orders' })).toBe('orders');
      });
    } finally {
      Reflect.defineProperty(Intl, 'PluralRules', {
        value: original,
        writable: true,
        configurable: true,
      });
    }
  });

  it('falls back to the other form when a category is missing', () => {
    expect(plural('en', 1, { other: 'orders' })).toBe('orders');
  });
});
