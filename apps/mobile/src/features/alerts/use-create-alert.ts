import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';

import { type Alert } from '@sarwa/contracts';
import {
  changeBps,
  negate,
  parseMoveBps,
  parseTicks,
  POLICY,
  toTradeQuote,
  useAlerts,
  useCreateAlert,
  useLiveSymbols,
  useQuote,
} from '@sarwa/core';

import { useCopy } from '../../lib/i18n';

type Condition = Alert['condition'];
type Repeat = Alert['repeat'];

const MINUTE_MS = 60_000;

const positive = (value: number | null) => (value !== null && value > 0 ? value : null);

// The create sheet's form: thresholds are parsed here, every rule is checked by core before sending.
export function useCreateAlertForm(symbol: string, onCreated: () => void) {
  const { t, f, alertIssue } = useCopy();
  useLiveSymbols([symbol]);
  const quote = useQuote(symbol);
  const create = useCreateAlert();
  const limit = useAlerts().data?.limit;
  const [condition, setCondition] = useState<Condition>('price_above');
  const [text, setText] = useState('');
  const [repeat, setRepeat] = useState<Repeat>('once');
  const isMove = condition === 'move_today';
  const live = quote ? toTradeQuote(quote) : null;
  const ticks = isMove ? null : positive(parseTicks(text));
  // A move can be negative (a down move), like the domain rule.
  const bps = isMove ? parseMoveBps(text) : null;

  const created = create.status === 'success';
  useEffect(() => {
    if (!created) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    create.reset();
    onCreated();
  }, [created, create, onCreated]);

  const distance = live && ticks !== null ? changeBps(live.lastTicks, ticks) : null;
  const issue = create.issue ? alertIssue(create.issue, symbol).explanation : null;
  const serverError =
    create.errorCode === 'ALERT_LIMIT' && limit !== undefined
      ? t.alerts.limitReached({ max: f.number(limit) })
      : create.error
        ? t.common.loadErrorBody
        : null;

  return {
    title: t.alerts.newAlertFor({ symbol }),
    now: live
      ? t.alerts.now({
          price: f.price(live.lastTicks),
          change: f.percent(changeBps(live.prevCloseTicks, live.lastTicks), { signed: true }),
        })
      : '',
    condition,
    conditions: (['price_above', 'price_below', 'move_today'] as const).map((value) => ({
      value,
      label: t.alerts.conditions[value],
    })),
    fieldLabel: isMove ? t.alerts.targetMove : t.alerts.targetPrice,
    prefix: isMove ? undefined : '$',
    signed: isMove,
    text,
    hint:
      distance === null || distance === 0
        ? undefined
        : distance > 0
          ? t.alerts.aboveCurrent({ pct: f.percent(distance) })
          : t.alerts.belowCurrent({ pct: f.percent(negate(distance)) }),
    error: issue ?? serverError ?? undefined,
    repeat,
    repeats: [
      { value: 'once' as const, label: t.alerts.repeats.once },
      {
        value: 'every' as const,
        label: t.alerts.repeats.every,
        a11yLabel: t.alerts.everyWithCooldown({
          duration: t.common.minutes(f.count(POLICY.alertCooldownMs / MINUTE_MS)),
        }),
      },
    ],
    canSubmit: (isMove ? bps : ticks) !== null && create.status !== 'pending',
    submitting: create.status === 'pending',
    actions: {
      setCondition: (next: Condition) => {
        create.reset();
        setCondition(next);
      },
      setText: (next: string) => {
        create.reset();
        setText(next);
      },
      setRepeat,
      submit: () => {
        create.create({
          symbol,
          condition,
          repeat,
          ...(isMove ? { thresholdBps: bps ?? 0 } : { thresholdTicks: ticks ?? 0 }),
        });
      },
    },
  };
}
