import { createFormatter } from '../src';

const LRI = '⁦';
const PDI = '⁩';
const isolated = (text: string) => `${LRI}${text}${PDI}`;

describe('createFormatter in English', () => {
  const f = createFormatter({ locale: 'en' });

  it('formats money with a $ and two decimals', () => {
    expect(f.money(123_456)).toBe('$1,234.56');
  });

  it('uses a real minus sign for negative money', () => {
    expect(f.money(-1_905)).toBe('−$19.05');
  });

  it('adds a plus sign to positive money when signed', () => {
    expect(f.money(2, { signed: true })).toBe('+$0.02');
    expect(f.money(-2, { signed: true })).toBe('−$0.02');
  });

  it('leaves zero unsigned when signed', () => {
    expect(f.money(0, { signed: true })).toBe('$0.00');
  });

  it('formats compact money like market caps', () => {
    expect(f.money(352_000_000_000_000, { compact: true })).toBe('$3.52T');
    expect(f.money(1_840_000_000, { compact: true })).toBe('$18.4M');
  });

  it('formats prices with two decimals and up to four only when needed', () => {
    expect(f.price(2_315_000)).toBe('$231.50');
    expect(f.price(2_314_825)).toBe('$231.4825');
  });

  it('trims trailing zeros from share quantities', () => {
    expect(f.shares(2_159_827)).toBe('2.159827');
    expect(f.shares(1_500_000)).toBe('1.5');
    expect(f.shares(42_000_000)).toBe('42');
  });

  it('formats percent from basis points with two decimals', () => {
    expect(f.percent(500)).toBe('5.00%');
    expect(f.percent(124, { signed: true })).toBe('+1.24%');
    expect(f.percent(-1_020, { signed: true })).toBe('−10.20%');
  });

  it('formats plain numbers with grouping and a real minus', () => {
    expect(f.number(1_036)).toBe('1,036');
    expect(f.number(-3)).toBe('−3');
  });

  it('pairs a count with its formatted text for plural messages', () => {
    expect(f.count(1_036)).toEqual({ count: 1_036, n: '1,036' });
  });

  it('does not isolate data in a left-to-right locale', () => {
    expect(f.money(-1_905)).not.toContain(LRI);
  });
});

describe('createFormatter in Arabic', () => {
  const arab = createFormatter({ locale: 'ar', digits: 'arab' });
  const latn = createFormatter({ locale: 'ar', digits: 'latn' });

  it('prints Arabic-Indic digits when digits are arab', () => {
    expect(arab.price(2_314_800)).toBe(isolated('$٢٣١٫٤٨'));
    expect(arab.money(123_456)).toBe(isolated('$١٬٢٣٤٫٥٦'));
  });

  it('prints Western digits when digits are latn', () => {
    expect(latn.price(2_314_800)).toBe(isolated('$231.48'));
    expect(latn.money(123_456)).toBe(isolated('$1,234.56'));
  });

  it('keeps sign, symbol and number together inside an LTR isolate', () => {
    expect(arab.money(-1_905, { signed: true })).toBe(isolated('−$١٩٫٠٥'));
    expect(arab.percent(124, { signed: true })).toBe(isolated('+١٫٢٤٪'));
    expect(latn.percent(124, { signed: true })).toBe(isolated('+1.24%'));
  });

  it('keeps Latin compact suffixes with Arabic-Indic digits', () => {
    expect(arab.money(352_000_000_000_000, { compact: true })).toBe(isolated('$٣٫٥٢T'));
  });

  it('leaves bare quantities unisolated because digits never reorder', () => {
    expect(arab.shares(2_159_827)).toBe('٢٫١٥٩٨٢٧');
    expect(arab.number(1_036)).toBe('١٬٠٣٦');
    expect(latn.shares(2_159_827)).toBe('2.159827');
  });

  it('isolates a negative bare number because of its sign', () => {
    expect(arab.number(-3)).toBe(isolated('−٣'));
  });
});

describe('times in New York', () => {
  const en = createFormatter({ locale: 'en' });
  const ar = createFormatter({ locale: 'ar', digits: 'arab' });
  const summer = Date.UTC(2026, 6, 1, 18, 41, 7);
  const winter = Date.UTC(2026, 10, 27, 19, 41, 7);

  it('formats a summer time as EDT (UTC−4) with an ET suffix', () => {
    expect(en.time(summer)).toBe('2:41 PM ET');
  });

  it('formats a winter time as EST (UTC−5) with an ET suffix', () => {
    expect(en.time(winter)).toBe('2:41 PM ET');
  });

  it('jumps from 1:59 AM to 3:00 AM when DST starts', () => {
    expect(en.time(Date.UTC(2026, 2, 8, 6, 59))).toBe('1:59 AM ET');
    expect(en.time(Date.UTC(2026, 2, 8, 7, 0))).toBe('3:00 AM ET');
  });

  it('repeats 1 AM when DST ends', () => {
    expect(en.time(Date.UTC(2026, 10, 1, 5, 30))).toBe('1:30 AM ET');
    expect(en.time(Date.UTC(2026, 10, 1, 6, 30))).toBe('1:30 AM ET');
  });

  it('includes seconds when asked', () => {
    expect(en.time(winter, { seconds: true })).toBe('2:41:07 PM ET');
  });

  it('formats a date and time', () => {
    expect(en.dateTime(winter)).toBe('Nov 27, 2:41 PM ET');
  });

  it('formats Arabic times with Arabic-Indic digits and keeps ET in Latin', () => {
    expect(ar.time(winter)).toBe('٢:٤١ م ET');
    expect(ar.dateTime(winter)).toBe('٢٧ نوفمبر، ٢:٤١ م ET');
  });
});

describe('relative', () => {
  const now = Date.UTC(2026, 10, 27, 19, 41);
  const minutes = (n: number) => now - n * 60_000;
  const en = createFormatter({ locale: 'en' });
  const ar = createFormatter({ locale: 'ar', digits: 'arab' });

  it('says just now under a minute', () => {
    expect(en.relative(now - 30_000, now)).toBe('Just now');
  });

  it('counts minutes under an hour', () => {
    expect(en.relative(minutes(2), now)).toBe('2 min ago');
  });

  it('counts hours under a day', () => {
    expect(en.relative(minutes(180), now)).toBe('3 h ago');
  });

  it('shows the date after a day', () => {
    expect(en.relative(minutes(2 * 24 * 60), now)).toBe('Nov 25');
  });

  it('treats a future time as just now', () => {
    expect(en.relative(now + 5_000, now)).toBe('Just now');
  });

  it('uses Arabic plural forms', () => {
    expect(ar.relative(minutes(1), now)).toBe('منذ دقيقة');
    expect(ar.relative(minutes(2), now)).toBe('منذ دقيقتين');
    expect(ar.relative(minutes(5), now)).toBe('منذ ٥ دقائق');
    expect(ar.relative(minutes(11), now)).toBe('منذ ١١ دقيقة');
    expect(ar.relative(minutes(180), now)).toBe('منذ ٣ ساعات');
  });
});
