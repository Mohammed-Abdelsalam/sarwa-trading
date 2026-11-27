import { POLICY } from '../src/rules';
import {
  addDays,
  type MarketCalendar,
  MARKET_TIME_ZONE,
  marketClock,
  marketSession,
  marketTime,
  nextTradingDay,
  NYSE_CALENDAR,
  orderExpiry,
  previousTradingDay,
  SESSION_HOURS,
  SESSION_MODES,
  SESSION_PHASES,
  TIME_IN_FORCE,
  tradingDay,
} from '../src/session';

const at = (h: number, m = 0) => h * 60 + m;
const utc = (date: string, h: number, m = 0) =>
  Date.parse(`${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`);
const HOUR = 3_600_000;

describe('market clock', () => {
  it('maps New York wall time to the instant in winter and summer', () => {
    expect(marketTime('2026-11-24', at(9, 30))).toBe(utc('2026-11-24', 14, 30));
    expect(marketTime('2026-07-01', at(9, 30))).toBe(utc('2026-07-01', 13, 30));
  });

  it('reads the New York date and minute of an instant', () => {
    expect(marketClock(utc('2026-11-25', 3, 15))).toEqual({
      date: '2026-11-24',
      minute: at(22, 15),
    });
  });

  it('switches the offset across DST start (2026-03-08)', () => {
    expect(marketTime('2026-03-06', at(9, 30))).toBe(utc('2026-03-06', 14, 30));
    expect(marketTime('2026-03-08', at(1))).toBe(utc('2026-03-08', 6));
    expect(marketTime('2026-03-08', at(3))).toBe(utc('2026-03-08', 7));
    expect(marketTime('2026-03-09', at(9, 30))).toBe(utc('2026-03-09', 13, 30));
    expect(marketTime('2026-03-09', 0) - marketTime('2026-03-08', 0)).toBe(23 * HOUR);
  });

  it('switches the offset back at DST end (2026-11-01)', () => {
    expect(marketTime('2026-10-30', at(9, 30))).toBe(utc('2026-10-30', 13, 30));
    expect(marketTime('2026-11-02', at(9, 30))).toBe(utc('2026-11-02', 14, 30));
    expect(marketTime('2026-11-02', 0) - marketTime('2026-11-01', 0)).toBe(25 * HOUR);
  });

  it('round-trips every existing minute of both DST changeover days', () => {
    const skippedOnMarch8 = (minute: number) => minute >= at(2) && minute < at(3);
    for (const date of ['2026-03-08', '2026-11-01']) {
      const minutes = Array.from({ length: 1_440 }, (_, minute) => minute).filter(
        (minute) => date !== '2026-03-08' || !skippedOnMarch8(minute),
      );

      const mismatches = minutes.filter((minute) => {
        const clock = marketClock(marketTime(date, minute));
        return clock.date !== date || clock.minute !== minute;
      });

      expect(mismatches).toEqual([]);
    }
  });

  it('adds days across month and year ends', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('calendar', () => {
  it('runs on New York time with the documented hours', () => {
    expect(MARKET_TIME_ZONE).toBe('America/New_York');
    expect(SESSION_HOURS).toEqual({
      preOpen: at(4),
      open: at(9, 30),
      close: at(16),
      earlyClose: at(13),
      postClose: at(20),
    });
  });

  it('lists Thanksgiving and Christmas as holidays and the day after as early closes', () => {
    expect(NYSE_CALENDAR.holidays).toMatchObject({
      '2026-11-26': 'Thanksgiving Day',
      '2026-12-25': 'Christmas Day',
    });
    expect(NYSE_CALENDAR.earlyCloses).toEqual({
      '2026-11-27': at(13),
      '2026-12-24': at(13),
      '2027-11-26': at(13),
    });
  });
});

describe('trading days', () => {
  it('opens 9:30–16:00 on a normal weekday', () => {
    expect(tradingDay('2026-11-24')).toEqual({
      date: '2026-11-24',
      opensAt: utc('2026-11-24', 14, 30),
      closesAt: utc('2026-11-24', 21),
      earlyClose: false,
    });
  });

  it('closes at 13:00 on an early-close day', () => {
    expect(tradingDay('2026-11-27')).toMatchObject({
      closesAt: utc('2026-11-27', 18),
      earlyClose: true,
    });
  });

  it('has no session on weekends and holidays', () => {
    expect(tradingDay('2026-11-28')).toBeNull();
    expect(tradingDay('2026-11-29')).toBeNull();
    expect(tradingDay('2026-11-26')).toBeNull();
    expect(tradingDay('2026-12-25')).toBeNull();
  });

  it('follows the calendar it is given', () => {
    const noHolidays: MarketCalendar = { holidays: {}, earlyCloses: {} };

    expect(tradingDay('2026-11-26', noHolidays)?.closesAt).toBe(utc('2026-11-26', 21));
  });

  it('finds the next and previous trading day around Thanksgiving', () => {
    expect(nextTradingDay('2026-11-26').date).toBe('2026-11-27');
    expect(nextTradingDay('2026-11-28').date).toBe('2026-11-30');
    expect(previousTradingDay('2026-11-29').date).toBe('2026-11-27');
    expect(previousTradingDay('2026-11-26').date).toBe('2026-11-25');
  });

  it('throws when no trading day is within 10 days', () => {
    const holidays = Object.fromEntries(
      Array.from({ length: 21 }, (_, i) => [addDays('2026-06-05', i), 'closed']),
    );
    const shut: MarketCalendar = { holidays, earlyCloses: {} };

    expect(() => nextTradingDay('2026-06-10', shut)).toThrow(RangeError);
    expect(() => previousTradingDay('2026-06-20', shut)).toThrow(RangeError);
  });
});

describe('marketSession', () => {
  const day = '2026-11-24';
  const today = { opensAt: utc(day, 14, 30), closesAt: utc(day, 21), earlyClose: false };
  const tomorrow = {
    opensAt: utc('2026-11-25', 14, 30),
    closesAt: utc('2026-11-25', 21),
    earlyClose: false,
  };

  it.each([
    [at(3, 59), 'closed', false, today],
    [at(4), 'pre', false, today],
    [at(9, 29), 'pre', false, today],
    [at(9, 30), 'regular', true, today],
    [at(15, 59), 'regular', true, today],
    [at(16), 'post', false, tomorrow],
    [at(19, 59), 'post', false, tomorrow],
    [at(20), 'closed', false, tomorrow],
  ])('at minute %p of a normal day is %s', (minute, phase, isOpen, session) => {
    expect(marketSession(marketTime(day, minute))).toEqual({ phase, isOpen, ...session });
  });

  it('passes through every phase over a normal day', () => {
    const phases = new Set(
      Array.from({ length: 24 }, (_, hour) => marketSession(marketTime(day, at(hour, 45))).phase),
    );

    expect([...phases].sort()).toEqual([...SESSION_PHASES].sort());
  });

  it('closes early on 2026-11-27 and runs post-market from 13:00', () => {
    const early = { opensAt: utc('2026-11-27', 14, 30), closesAt: utc('2026-11-27', 18) };

    expect(marketSession(marketTime('2026-11-27', at(12, 59)))).toMatchObject({
      phase: 'regular',
      earlyClose: true,
      ...early,
    });
    expect(marketSession(marketTime('2026-11-27', at(13)))).toEqual({
      phase: 'post',
      isOpen: false,
      opensAt: utc('2026-11-30', 14, 30),
      closesAt: utc('2026-11-30', 21),
      earlyClose: false,
    });
  });

  it('stays closed all Thanksgiving and points at the early-close Friday', () => {
    const friday = {
      phase: 'closed',
      isOpen: false,
      opensAt: utc('2026-11-27', 14, 30),
      closesAt: utc('2026-11-27', 18),
      earlyClose: true,
    };

    expect(marketSession(marketTime('2026-11-26', at(6)))).toEqual(friday);
    expect(marketSession(marketTime('2026-11-26', at(10)))).toEqual(friday);
    expect(marketSession(marketTime('2026-11-26', at(17)))).toEqual(friday);
  });

  it('stays closed over the weekend until Monday', () => {
    const session = marketSession(marketTime('2026-11-28', at(10)));

    expect(session).toMatchObject({ phase: 'closed', isOpen: false });
    expect(session.opensAt).toBe(utc('2026-11-30', 14, 30));
  });

  it('opens Monday at the new offset after DST starts', () => {
    const sunday = marketSession(marketTime('2026-03-08', at(12)));

    expect(sunday.opensAt).toBe(utc('2026-03-09', 13, 30));
    expect(marketSession(utc('2026-03-09', 13, 30)).phase).toBe('regular');
    expect(marketSession(utc('2026-03-09', 13, 29)).phase).toBe('pre');
  });

  it('follows the calendar it is given', () => {
    const noHolidays: MarketCalendar = { holidays: {}, earlyCloses: {} };

    expect(marketSession(marketTime('2026-11-26', at(10)), 'calendar', noHolidays).phase).toBe(
      'regular',
    );
  });

  it('is open at any hour in always-open mode, ending the day at New York midnight', () => {
    const now = marketTime('2026-11-28', at(3));

    expect(marketSession(now, 'always-open')).toEqual({
      phase: 'regular',
      isOpen: true,
      opensAt: now,
      closesAt: marketTime('2026-11-29', 0),
      earlyClose: false,
    });
  });

  it('ends a 23-hour always-open day on DST start', () => {
    const now = marketTime('2026-03-08', 0);

    expect(marketSession(now, 'always-open').closesAt - now).toBe(23 * HOUR);
  });
});

describe('orderExpiry', () => {
  it('expires a day order at the close of the session it works in', () => {
    expect(orderExpiry('day', marketTime('2026-11-24', at(10)))).toBe(utc('2026-11-24', 21));
    expect(orderExpiry('day', marketTime('2026-11-24', at(8)))).toBe(utc('2026-11-24', 21));
  });

  it('expires a day order placed after the close at the next close', () => {
    expect(orderExpiry('day', marketTime('2026-11-24', at(17)))).toBe(utc('2026-11-25', 21));
    expect(orderExpiry('day', marketTime('2026-11-28', at(10)))).toBe(utc('2026-11-30', 21));
  });

  it('expires a day order at the early close', () => {
    expect(orderExpiry('day', marketTime('2026-11-27', at(10)))).toBe(utc('2026-11-27', 18));
    expect(orderExpiry('day', marketTime('2026-11-26', at(10)))).toBe(utc('2026-11-27', 18));
  });

  it('expires GTC at the close 90 days out', () => {
    expect(orderExpiry('gtc', marketTime('2026-11-24', at(10)))).toBe(utc('2027-02-22', 21));
  });

  it('moves GTC back to the previous trading day when 90 days out is a holiday', () => {
    expect(orderExpiry('gtc', marketTime('2026-08-28', at(10)))).toBe(utc('2026-11-25', 21));
  });

  it('moves GTC landing on Christmas back to the early close on the 24th', () => {
    expect(orderExpiry('gtc', marketTime('2026-09-26', at(10)))).toBe(utc('2026-12-24', 18));
  });

  it('uses the calendar it is given', () => {
    const noHolidays: MarketCalendar = { holidays: {}, earlyCloses: {} };

    expect(orderExpiry('gtc', marketTime('2026-08-28', at(10)), 'calendar', noHolidays)).toBe(
      utc('2026-11-26', 21),
    );
  });

  it.each(SESSION_MODES.flatMap((mode) => TIME_IN_FORCE.map((tif) => [mode, tif] as const)))(
    'expires a %s-mode %s order after it is placed and by the end of day 90',
    (mode, tif) => {
      const placedAt = marketTime('2026-11-24', at(10));

      const expiresAt = orderExpiry(tif, placedAt, mode);

      expect(expiresAt).toBeGreaterThan(placedAt);
      expect(expiresAt).toBeLessThan(marketTime(addDays('2026-11-24', POLICY.gtcDays + 1), 0));
    },
  );

  it('ends day orders at midnight and GTC after 90 × 24h in always-open mode', () => {
    const placedAt = marketTime('2026-11-28', at(3));

    expect(orderExpiry('day', placedAt, 'always-open')).toBe(marketTime('2026-11-29', 0));
    expect(orderExpiry('gtc', placedAt, 'always-open')).toBe(
      placedAt + POLICY.gtcDays * 86_400_000,
    );
  });
});
