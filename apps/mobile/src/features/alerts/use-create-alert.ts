import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';

import { alertTargetHint, changeBps, POLICY, toTradeQuote, useAlertForm } from '@sarwa/core';

import { useCopy } from '../../lib/i18n';

const MINUTE_MS = 60_000;

// The create sheet's form: thresholds are parsed and every rule is checked by core before sending.
export function useCreateAlertForm(symbol: string, onCreated: () => void) {
  const copy = useCopy();
  const { t, f, alertIssue } = copy;
  const form = useAlertForm(symbol);
  const { condition, repeat } = form;
  const isMove = condition === 'move_today';
  const live = form.quote ? toTradeQuote(form.quote) : null;

  const created = form.status === 'success';
  const { reset } = form;
  useEffect(() => {
    if (!created) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    reset();
    onCreated();
  }, [created, reset, onCreated]);

  const issue = form.issue ? alertIssue(form.issue, symbol).explanation : null;
  const serverError =
    form.limitReached !== null
      ? t.alerts.limitReached({ max: f.number(form.limitReached) })
      : form.failed
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
    prefix: isMove ? undefined : f.currencyAffix(),
    signed: isMove,
    text: form.target,
    hint: alertTargetHint(form.request, live?.lastTicks ?? null, copy),
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
    canSubmit: form.request !== null && form.status !== 'pending',
    submitting: form.status === 'pending',
    actions: {
      setCondition: form.setCondition,
      setText: form.setTarget,
      setRepeat: form.setRepeat,
      submit: () => {
        form.submit();
      },
    },
  };
}
