import { POLICY } from './rules';

export const MARKET_TIME_ZONE = 'America/New_York';

export const SESSION_MODES = ['calendar', 'always-open'] as const;
export type SessionMode = (typeof SESSION_MODES)[number];

export const SESSION_PHASES = ['pre', 'regular', 'post', 'closed'] as const;
export type SessionPhase = (typeof SESSION_PHASES)[number];

// A calendar date in New York, YYYY-MM-DD.
export type MarketDate = string;

export interface MarketCalendar {
  holidays: Readonly<Record<MarketDate, string>>;
  // Close time in minutes after New York midnight, for days that close early.
  earlyCloses: Readonly<Record<MarketDate, number>>;
}

const minutes = (hours: number, mins = 0) => hours * 60 + mins;

export const SESSION_HOURS = {
  preOpen: minutes(4),
  open: minutes(9, 30),
  close: minutes(16),
  earlyClose: minutes(13),
  postClose: minutes(20),
} as const;

// NYSE holidays and early closes (published schedule). Weekdays past 2027 count as trading days.
export const NYSE_CALENDAR: MarketCalendar = {
  holidays: {
    '2026-01-01': "New Year's Day",
    '2026-01-19': 'Martin Luther King Jr. Day',
    '2026-02-16': "Washington's Birthday",
    '2026-04-03': 'Good Friday',
    '2026-05-25': 'Memorial Day',
    '2026-06-19': 'Juneteenth',
    '2026-07-03': 'Independence Day (observed)',
    '2026-09-07': 'Labor Day',
    '2026-11-26': 'Thanksgiving Day',
    '2026-12-25': 'Christmas Day',
    '2027-01-01': "New Year's Day",
    '2027-01-18': 'Martin Luther King Jr. Day',
    '2027-02-15': "Washington's Birthday",
    '2027-03-26': 'Good Friday',
    '2027-05-31': 'Memorial Day',
    '2027-06-18': 'Juneteenth (observed)',
    '2027-07-05': 'Independence Day (observed)',
    '2027-09-06': 'Labor Day',
    '2027-11-25': 'Thanksgiving Day',
    '2027-12-24': 'Christmas Day (observed)',
  },
  earlyCloses: {
    '2026-11-27': SESSION_HOURS.earlyClose,
    '2026-12-24': SESSION_HOURS.earlyClose,
    '2027-11-26': SESSION_HOURS.earlyClose,
  },
};

const clockFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: MARKET_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function zonedParts(ms: number): { date: MarketDate; minute: number; second: number } {
  const part = Object.fromEntries(clockFormat.formatToParts(ms).map((p) => [p.type, p.value]));
  return {
    date: `${String(part.year)}-${String(part.month)}-${String(part.day)}`,
    minute: Number(part.hour) * 60 + Number(part.minute),
    second: Number(part.second),
  };
}

// The wall-clock date and minute of an instant in New York.
export function marketClock(ms: number): { date: MarketDate; minute: number } {
  const { date, minute } = zonedParts(ms);
  return { date, minute };
}

function utcOfDate(date: MarketDate): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

export function addDays(date: MarketDate, days: number): MarketDate {
  return new Date(utcOfDate(date) + days * 86_400_000).toISOString().slice(0, 10);
}

// New York wall time → instant. The offset is read twice so DST changeover days resolve too.
export function marketTime(date: MarketDate, minuteOfDay: number): number {
  const guess = utcOfDate(date) + minuteOfDay * 60_000;
  const offsetAt = (ms: number) => {
    const parts = zonedParts(ms);
    return utcOfDate(parts.date) + (parts.minute * 60 + parts.second) * 1_000 - ms;
  };
  const first = guess - offsetAt(guess);
  return guess - offsetAt(first);
}

export interface TradingDay {
  date: MarketDate;
  opensAt: number;
  closesAt: number;
  earlyClose: boolean;
}

export function tradingDay(
  date: MarketDate,
  calendar: MarketCalendar = NYSE_CALENDAR,
): TradingDay | null {
  const weekday = new Date(utcOfDate(date)).getUTCDay();
  if (weekday === 0 || weekday === 6 || date in calendar.holidays) return null;
  const close = calendar.earlyCloses[date];
  return {
    date,
    opensAt: marketTime(date, SESSION_HOURS.open),
    closesAt: marketTime(date, close ?? SESSION_HOURS.close),
    earlyClose: close !== undefined,
  };
}

// The first trading day on or after `date` (the calendar never has 10 closed days in a row).
export function nextTradingDay(date: MarketDate, calendar = NYSE_CALENDAR): TradingDay {
  for (let i = 0; i < 10; i += 1) {
    const day = tradingDay(addDays(date, i), calendar);
    if (day) return day;
  }
  throw new RangeError(`No trading day within 10 days of ${date}`);
}

export function previousTradingDay(date: MarketDate, calendar = NYSE_CALENDAR): TradingDay {
  for (let i = 0; i < 10; i += 1) {
    const day = tradingDay(addDays(date, -i), calendar);
    if (day) return day;
  }
  throw new RangeError(`No trading day within 10 days before ${date}`);
}

export interface MarketSession {
  phase: SessionPhase;
  isOpen: boolean;
  // The current session's open and close while open; otherwise the next session's.
  opensAt: number;
  closesAt: number;
  earlyClose: boolean;
}

function nextMidnight(now: number): number {
  return marketTime(addDays(marketClock(now).date, 1), 0);
}

// `always-open` keeps a demo tradable at any hour; the day still ends at New York midnight.
export function marketSession(
  now: number,
  mode: SessionMode = 'calendar',
  calendar: MarketCalendar = NYSE_CALENDAR,
): MarketSession {
  if (mode === 'always-open') {
    return {
      phase: 'regular',
      isOpen: true,
      opensAt: now,
      closesAt: nextMidnight(now),
      earlyClose: false,
    };
  }
  const { date, minute } = marketClock(now);
  const today = tradingDay(date, calendar);
  if (today && now >= today.opensAt && now < today.closesAt) {
    return { phase: 'regular', isOpen: true, ...pick(today) };
  }
  const upcoming =
    today && now < today.opensAt ? today : nextTradingDay(addDays(date, 1), calendar);
  let phase: SessionPhase = 'closed';
  if (today && now < today.opensAt && minute >= SESSION_HOURS.preOpen) phase = 'pre';
  if (today && now >= today.closesAt && minute < SESSION_HOURS.postClose) phase = 'post';
  return { phase, isOpen: false, ...pick(upcoming) };
}

function pick({ opensAt, closesAt, earlyClose }: TradingDay) {
  return { opensAt, closesAt, earlyClose };
}

export const TIME_IN_FORCE = ['day', 'gtc'] as const;
export type TimeInForce = (typeof TIME_IN_FORCE)[number];

// Day orders end at the close of the session they work in (the next one when placed while closed).
// GTC ends at the last close on or before 90 days out, so it never lands on a holiday.
export function orderExpiry(
  tif: TimeInForce,
  placedAt: number,
  mode: SessionMode = 'calendar',
  calendar: MarketCalendar = NYSE_CALENDAR,
): number {
  if (mode === 'always-open') {
    return tif === 'day' ? nextMidnight(placedAt) : placedAt + POLICY.gtcDays * 86_400_000;
  }
  if (tif === 'day') return marketSession(placedAt, mode, calendar).closesAt;
  const lastDay = addDays(marketClock(placedAt).date, POLICY.gtcDays);
  return previousTradingDay(lastDay, calendar).closesAt;
}
