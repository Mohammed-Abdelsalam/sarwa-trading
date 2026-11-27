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

  it('falls back to the other form when a category is missing', () => {
    expect(plural('en', 1, { other: 'orders' })).toBe('orders');
  });
});
