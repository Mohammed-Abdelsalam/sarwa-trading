import {
  type AlertIssue,
  bps,
  cents,
  micros,
  type Rejection,
  REJECTION_CODES,
  type RejectionCode,
  ticks,
} from '@sarwa/domain';

import {
  type AlertIssueCode,
  alertIssueMessage,
  type Copy,
  LOCALES,
  rejectionMessage,
} from '../src';

const REJECTIONS: Record<RejectionCode, Rejection> = {
  TRADING_DISABLED: { code: 'TRADING_DISABLED' },
  MARKET_PAUSED: { code: 'MARKET_PAUSED' },
  SYMBOL_HALTED: { code: 'SYMBOL_HALTED' },
  MARKET_CLOSED: { code: 'MARKET_CLOSED' },
  STALE_QUOTE: { code: 'STALE_QUOTE', ageMs: 8_400, maxAgeMs: 5_000 },
  INVALID_PRICE: { code: 'INVALID_PRICE', field: 'stop', lastTicks: ticks(2_314_800) },
  PRICE_COLLAR: {
    code: 'PRICE_COLLAR',
    field: 'limit',
    minTicks: ticks(2_235_200),
    maxTicks: ticks(2_731_900),
  },
  MIN_NOTIONAL: { code: 'MIN_NOTIONAL', field: 'size', minCents: cents(100) },
  MAX_NOTIONAL: { code: 'MAX_NOTIONAL', field: 'size', maxCents: cents(25_000_000) },
  INSUFFICIENT_FUNDS: {
    code: 'INSUFFICIENT_FUNDS',
    field: 'size',
    requiredCents: cents(5_846_000),
    availableCents: cents(312_000),
  },
  INSUFFICIENT_SHARES: {
    code: 'INSUFFICIENT_SHARES',
    field: 'size',
    sellableMicros: micros(25_000_000),
  },
};

const ALERT_ISSUES: Record<AlertIssueCode, AlertIssue> = {
  ALREADY_ABOVE: { code: 'ALREADY_ABOVE', lastTicks: ticks(2_314_800) },
  ALREADY_BELOW: { code: 'ALREADY_BELOW', lastTicks: ticks(2_314_800) },
  ALREADY_MOVED: { code: 'ALREADY_MOVED', moveBps: bps(520) },
  MISSING_THRESHOLD: { code: 'MISSING_THRESHOLD' },
};

const context = { symbol: 'TSLA' };

const VALID = expect.stringMatching(/^(?!.*(undefined|NaN|\[object)).+$/s);
const complete: Copy = { reason: VALID, explanation: VALID };

describe('rejectionMessage', () => {
  it.each(LOCALES.flatMap((locale) => REJECTION_CODES.map((code) => [locale, code] as const)))(
    'has %s copy for %s',
    (locale, code) => {
      expect(rejectionMessage(REJECTIONS[code], locale, 'latn', context)).toEqual(complete);
    },
  );

  it('names the halted symbol on the button reason', () => {
    const copy = rejectionMessage(REJECTIONS.SYMBOL_HALTED, 'en', 'latn', context);

    expect(copy.reason).toBe('Trading paused — TSLA halted');
  });

  it('formats collar prices from ticks', () => {
    const copy = rejectionMessage(REJECTIONS.PRICE_COLLAR, 'en', 'latn', context);

    expect(copy.reason).toBe('Limit price too far from market');
    expect(copy.explanation).toBe('Price too far from market (collar: $223.52 – $273.19).');
  });

  it('rounds quote age up to whole seconds', () => {
    const copy = rejectionMessage(REJECTIONS.STALE_QUOTE, 'en', 'latn', context);

    expect(copy.explanation).toBe(
      'Quote is 9 s old. We only accept orders on quotes fresher than 5 s.',
    );
  });

  it('formats money and shares with the requested digits', () => {
    const funds = rejectionMessage(REJECTIONS.INSUFFICIENT_FUNDS, 'ar', 'arab', context);
    const shares = rejectionMessage(REJECTIONS.INSUFFICIENT_SHARES, 'en', 'latn', context);

    expect(funds.explanation).toContain('$٥٨٬٤٦٠٫٠٠');
    expect(funds.explanation).toContain('$٣٬١٢٠٫٠٠');
    expect(shares.explanation).toContain('You can sell up to 25 sh.');
  });

  it('names a stop field in the collar reason', () => {
    const stop: Rejection = {
      code: 'PRICE_COLLAR',
      field: 'stop',
      minTicks: ticks(2_235_200),
      maxTicks: ticks(2_731_900),
    };

    expect(rejectionMessage(stop, 'en', 'latn', context).reason).toBe(
      'Stop price too far from market',
    );
    expect(rejectionMessage(stop, 'ar', 'latn', context).reason).toBe(
      'سعر الإيقاف بعيد جدًا عن السوق',
    );
  });
});

describe('client-only blocks', () => {
  it.each(LOCALES)('has %s copy for a dropped price stream', (locale) => {
    const copy = rejectionMessage({ code: 'CONNECTION_NOT_LIVE' }, locale, 'latn', context);

    expect(copy).toEqual(complete);
  });

  it.each(LOCALES)('has %s copy while the trading status loads', (locale) => {
    const copy = rejectionMessage({ code: 'STATUS_LOADING' }, locale, 'latn', context);

    expect(copy).toEqual(complete);
  });

  it('says Loading… on the button', () => {
    expect(rejectionMessage({ code: 'STATUS_LOADING' }, 'en', 'latn', context).reason).toBe(
      'Loading…',
    );
  });
});

describe('param formatting per code', () => {
  it('formats each param by its unit in the chosen digits', () => {
    const funds = rejectionMessage(REJECTIONS.INSUFFICIENT_FUNDS, 'ar', 'arab', context);
    const stale = rejectionMessage(REJECTIONS.STALE_QUOTE, 'en', 'latn', context);
    const moved = alertIssueMessage(ALERT_ISSUES.ALREADY_MOVED, 'en', 'latn', context);

    expect(funds.explanation).toContain('⁦$٥٨٬٤٦٠٫٠٠⁩');
    expect(funds.explanation).toContain('⁦$٣٬١٢٠٫٠٠⁩');
    expect(stale.reason).toBe('Quote is 9 s old');
    expect(moved.reason).toBe('Already moved +5.20% today');
  });
});

describe('alertIssueMessage', () => {
  it.each(
    LOCALES.flatMap((locale) =>
      (Object.keys(ALERT_ISSUES) as AlertIssueCode[]).map((code) => [locale, code] as const),
    ),
  )('has %s copy for %s', (locale, code) => {
    expect(alertIssueMessage(ALERT_ISSUES[code], locale, 'latn', context)).toEqual(complete);
  });

  it('suggests the opposite condition when a below alert is already met', () => {
    const copy = alertIssueMessage(ALERT_ISSUES.ALREADY_BELOW, 'en', 'latn', { symbol: 'AAPL' });

    expect(copy.explanation).toBe(
      '“Below” must be under the current price ($231.48) — did you mean “above”?',
    );
  });

  it('shows the move already made as a signed percent', () => {
    const copy = alertIssueMessage(ALERT_ISSUES.ALREADY_MOVED, 'ar', 'arab', { symbol: 'NVDA' });

    expect(copy.explanation).toContain('NVDA');
    expect(copy.explanation).toContain('⁦+٥٫٢٠٪⁩');
  });
});
