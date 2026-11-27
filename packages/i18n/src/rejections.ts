import { type AlertIssue, type Rejection } from '@sarwa/domain';

import { getMessages } from './catalog';
import {
  type AlertIssueCode,
  type AlertIssueParamTable,
  type ClientBlock,
  type Copy,
  type Formatted,
  type RejectionKey,
  type RejectionParamTable,
  type SymbolContext,
} from './copy';
import { createFormatter, type Formatter } from './format';
import { type Digits, type Locale } from './locale';

type ParamFormatters<Table> = {
  [C in keyof Table]: (params: Table[C], f: Formatter) => Formatted<Table[C]>;
};

const seconds = (f: Formatter, ms: number) => f.number(Math.ceil(ms / 1000));

// One entry per code: a new code or param doesn't compile until it says how it is formatted.
const REJECTION_PARAMS: ParamFormatters<RejectionParamTable> = {
  TRADING_DISABLED: () => ({}),
  MARKET_PAUSED: () => ({}),
  SYMBOL_HALTED: () => ({}),
  MARKET_CLOSED: () => ({}),
  CONNECTION_NOT_LIVE: () => ({}),
  STATUS_LOADING: () => ({}),
  STALE_QUOTE: ({ ageMs, maxAgeMs }, f) => ({
    ageMs: seconds(f, ageMs),
    maxAgeMs: seconds(f, maxAgeMs),
  }),
  INVALID_PRICE: ({ field, lastTicks }, f) => ({ field, lastTicks: f.price(lastTicks) }),
  PRICE_COLLAR: ({ field, minTicks, maxTicks }, f) => ({
    field,
    minTicks: f.price(minTicks),
    maxTicks: f.price(maxTicks),
  }),
  MIN_NOTIONAL: ({ field, minCents }, f) => ({ field, minCents: f.money(minCents) }),
  MAX_NOTIONAL: ({ field, maxCents }, f) => ({ field, maxCents: f.money(maxCents) }),
  INSUFFICIENT_FUNDS: ({ field, requiredCents, availableCents }, f) => ({
    field,
    requiredCents: f.money(requiredCents),
    availableCents: f.money(availableCents),
  }),
  INSUFFICIENT_SHARES: ({ field, sellableMicros }, f) => ({
    field,
    sellableMicros: f.shares(sellableMicros),
  }),
};

const ALERT_ISSUE_PARAMS: ParamFormatters<AlertIssueParamTable> = {
  ALREADY_ABOVE: ({ lastTicks }, f) => ({ lastTicks: f.price(lastTicks) }),
  ALREADY_BELOW: ({ lastTicks }, f) => ({ lastTicks: f.price(lastTicks) }),
  ALREADY_MOVED: ({ moveBps }, f) => ({ moveBps: f.percent(moveBps, { signed: true }) }),
  MISSING_THRESHOLD: () => ({}),
};

// Generic over the code, so the compiler pairs each code's params, formatter and copy.
function renderRejection<C extends RejectionKey>(
  code: C,
  params: RejectionParamTable[C],
  f: Formatter,
  context: SymbolContext,
): Copy {
  return getMessages(f.locale).rejections[code]({
    ...REJECTION_PARAMS[code](params, f),
    ...context,
  });
}

function renderAlertIssue<C extends AlertIssueCode>(
  code: C,
  params: AlertIssueParamTable[C],
  f: Formatter,
  context: SymbolContext,
): Copy {
  return getMessages(f.locale).alertIssues[code]({
    ...ALERT_ISSUE_PARAMS[code](params, f),
    ...context,
  });
}

export function rejectionMessage(
  rejection: Rejection | ClientBlock,
  locale: Locale,
  digits: Digits,
  context: SymbolContext,
): Copy {
  const { code, ...params } = rejection;
  return renderRejection(code, params, createFormatter({ locale, digits }), context);
}

export function alertIssueMessage(
  issue: AlertIssue,
  locale: Locale,
  digits: Digits,
  context: SymbolContext,
): Copy {
  const { code, ...params } = issue;
  return renderAlertIssue(code, params, createFormatter({ locale, digits }), context);
}
