import {
  type Bps,
  type Cents,
  MARKET_TIME_ZONE,
  type Micros,
  microsToShares,
  type Ticks,
  ticksToDollars,
} from '@sarwa/domain';

import { getMessages } from './catalog';
import { type Count } from './copy';
import { DEFAULT_DIGITS, type Digits, INTL_LOCALE, isRtl, type Locale } from './locale';

const MINUS = '−';
const LTR_ISOLATE = '⁦';
const POP_ISOLATE = '⁩';
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export interface FormatterOptions {
  locale: Locale;
  digits?: Digits;
}

export interface MoneyOptions {
  signed?: boolean;
  compact?: boolean;
  whole?: boolean;
}

// The chart periods (contracts' Period): axis labels and the scrubbed candle's date depend on them.
export type ChartSpan = '1D' | '1W' | '1M' | '1Y' | 'ALL';

export interface Formatter {
  locale: Locale;
  digits: Digits;
  money(cents: Cents, options?: MoneyOptions): string;
  price(ticks: Ticks): string;
  shares(micros: Micros): string;
  percent(bps: Bps, options?: { signed?: boolean }): string;
  number(value: number): string;
  compact(value: number): string;
  count(value: number): Count;
  time(ms: number, options?: { seconds?: boolean }): string;
  dateTime(ms: number): string;
  date(ms: number, options?: { weekday?: boolean }): string;
  multiplier(value: number): string;
  relative(ms: number, now: number): string;
  chartTime(ms: number, span: ChartSpan): string;
  chartDate(ms: number, span: ChartSpan): string;
}

const formatters = new Map<string, Formatter>();

// Intl formatters are costly to build, so each (locale, digits) pair gets one shared instance.
export function createFormatter({ locale, digits = DEFAULT_DIGITS }: FormatterOptions): Formatter {
  const key = `${locale}:${digits}`;
  const cached = formatters.get(key);
  if (cached) return cached;
  const formatter = buildFormatter(locale, digits);
  formatters.set(key, formatter);
  return formatter;
}

function buildFormatter(locale: Locale, digits: Digits): Formatter {
  const messages = getMessages(locale).common;
  const numbers = (options: Intl.NumberFormatOptions, tag = INTL_LOCALE[locale]) =>
    new Intl.NumberFormat(tag, { numberingSystem: digits, ...options });
  const dates = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(INTL_LOCALE[locale], {
      numberingSystem: digits,
      timeZone: MARKET_TIME_ZONE,
      ...options,
    });

  const twoDecimals = numbers({ minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const noDecimals = numbers({ maximumFractionDigits: 0 });
  const priceDecimals = numbers({ minimumFractionDigits: 2, maximumFractionDigits: 4 });
  const shareDecimals = numbers({ maximumFractionDigits: 6 });
  const plain = numbers({});
  // Suffixes stay Latin (K, M, B, T) like tickers, so "$3.52T" has the same shape in both languages.
  const compact = numbers({ notation: 'compact', maximumFractionDigits: 2 }, INTL_LOCALE.en);
  const clock = dates({ hour: 'numeric', minute: '2-digit' });
  const clockSeconds = dates({ hour: 'numeric', minute: '2-digit', second: '2-digit' });
  const dayClock = dates({ month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const day = dates({ month: 'short', day: 'numeric' });
  const weekday = dates({ weekday: 'short', month: 'short', day: 'numeric' });
  const monthDayYear = dates({ month: 'short', day: 'numeric', year: 'numeric' });
  const monthYear = dates({ month: 'short', year: 'numeric' });
  const oneDecimal = numbers({ minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const percentSign = digits === 'arab' ? '٪' : '%';

  const chartTimes: Record<ChartSpan, Intl.DateTimeFormat> = {
    '1D': clock,
    '1W': dates({ weekday: 'short' }),
    '1M': day,
    '1Y': dates({ month: 'short' }),
    ALL: dates({ year: 'numeric' }),
  };
  const chartDates: Record<ChartSpan, (ms: number) => string> = {
    '1D': (ms) => `${day.format(ms)} · ${clock.format(ms)}`,
    '1W': (ms) => weekday.format(ms),
    '1M': (ms) => monthDayYear.format(ms),
    '1Y': (ms) => monthDayYear.format(ms),
    ALL: (ms) => monthYear.format(ms),
  };

  // Signs and symbols are neutral in the bidi algorithm: isolate them so "+1.24%" stays LTR in Arabic.
  const isolate = (text: string) => (isRtl(locale) ? `${LTR_ISOLATE}${text}${POP_ISOLATE}` : text);
  const withSign = (value: number, body: string, plus = false) =>
    isolate(`${value < 0 ? MINUS : plus && value > 0 ? '+' : ''}${body}`);

  const unsigned = (format: Intl.NumberFormat, value: number) => {
    const text = format.format(Math.abs(value));
    return value < 0 ? withSign(value, text) : text;
  };
  const number = (value: number) => unsigned(plain, value);
  const count = (value: number): Count => ({ count: value, n: number(value) });

  return {
    locale,
    digits,
    money: (cents, { signed = false, compact: short = false, whole = false } = {}) => {
      const dollars = Math.abs(cents) / 100;
      const format = short ? compact : whole ? noDecimals : twoDecimals;
      return withSign(cents, `$${format.format(dollars)}`, signed);
    },
    price: (ticks) => withSign(ticks, `$${priceDecimals.format(Math.abs(ticksToDollars(ticks)))}`),
    shares: (micros) => unsigned(shareDecimals, microsToShares(micros)),
    percent: (bps, { signed = false } = {}) =>
      withSign(bps, `${twoDecimals.format(Math.abs(bps) / 100)}${percentSign}`, signed),
    number,
    compact: (value) => unsigned(compact, value),
    count,
    time: (ms, { seconds = false } = {}) => `${(seconds ? clockSeconds : clock).format(ms)} ET`,
    dateTime: (ms) => `${dayClock.format(ms)} ET`,
    date: (ms, { weekday: withWeekday = false } = {}) => (withWeekday ? weekday : day).format(ms),
    multiplier: (value) => `${unsigned(oneDecimal, value)}×`,
    relative: (ms, now) => {
      const elapsed = Math.max(0, now - ms);
      if (elapsed < MINUTE_MS) return messages.justNow;
      if (elapsed < HOUR_MS) return messages.minutesAgo(count(Math.floor(elapsed / MINUTE_MS)));
      if (elapsed < DAY_MS) return messages.hoursAgo(count(Math.floor(elapsed / HOUR_MS)));
      return day.format(ms);
    },
    chartTime: (ms, span) => chartTimes[span].format(ms),
    chartDate: (ms, span) => chartDates[span](ms),
  };
}
