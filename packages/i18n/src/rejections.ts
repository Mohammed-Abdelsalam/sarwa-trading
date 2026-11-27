import { type AlertIssue, type Rejection } from '@sarwa/domain';

import { getMessages } from './catalog';
import { type Copy, type SymbolContext } from './copy';
import { createFormatter, type Formatter } from './format';
import { type Digits, type Locale } from './locale';

// Domain params name their unit in the key (lastTicks, minCents…), which picks the formatter.
const FORMAT_BY_UNIT: [RegExp, (f: Formatter, value: number) => string][] = [
  [/Ticks$/, (f, value) => f.price(value)],
  [/Cents$/, (f, value) => f.money(value)],
  [/Micros$/, (f, value) => f.shares(value)],
  [/Bps$/, (f, value) => f.percent(value, { signed: true })],
  [/Ms$/, (f, value) => f.number(Math.ceil(value / 1000))],
];

function formatParams(params: object, f: Formatter): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(params).map(([key, value]: [string, unknown]) => {
      if (typeof value !== 'number') return [key, value];
      const format = FORMAT_BY_UNIT.find(([unit]) => unit.test(key))?.[1];
      return [key, format ? format(f, value) : f.number(value)];
    }),
  );
}

// The code narrows the params at runtime; TS can't correlate the union with its table entry.
function render(
  copy: unknown,
  params: object,
  { locale, digits }: { locale: Locale; digits: Digits },
  context: SymbolContext,
): Copy {
  const formatted = formatParams(params, createFormatter({ locale, digits }));
  return (copy as (params: object) => Copy)({ ...formatted, ...context });
}

export function rejectionMessage(
  rejection: Rejection,
  locale: Locale,
  digits: Digits,
  context: SymbolContext,
): Copy {
  const { code, ...params } = rejection;
  return render(getMessages(locale).rejections[code], params, { locale, digits }, context);
}

export function alertIssueMessage(
  issue: AlertIssue,
  locale: Locale,
  digits: Digits,
  context: SymbolContext,
): Copy {
  const { code, ...params } = issue;
  return render(getMessages(locale).alertIssues[code], params, { locale, digits }, context);
}
