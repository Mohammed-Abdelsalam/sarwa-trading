import { useEffect, useState } from 'react';

import { type Alert } from '@sarwa/contracts';
import {
  alertTargetHint,
  bps,
  changeBps,
  direction,
  DIRECTION_ARROW,
  POLICY,
  toTradeQuote,
  type AuthIntent,
  useAlertForm,
  useStocks,
} from '@sarwa/core';

import { useCopy } from '../../lib/i18n';
import { useResumedIntent } from '../gating/auth-ui';

export type AlertCondition = Alert['condition'];
export type AlertRepeat = Alert['repeat'];

export type ResumedAlert = Extract<AuthIntent, { kind: 'alert' }>;

// A guest's alert, back after sign-in with its condition and price, waiting to be created.
export function useResumedAlert(): ResumedAlert | null {
  return useResumedIntent((intent): intent is ResumedAlert => intent.kind === 'alert');
}

export function useAlertDialog({
  initialSymbol,
  onClose,
  resumed = null,
}: {
  initialSymbol: string | null;
  onClose: () => void;
  resumed?: ResumedAlert | null;
}) {
  const copy = useCopy();
  const { t, f, m } = copy;
  const stocks = useStocks();
  const [symbol, setSymbol] = useState(resumed?.symbol ?? initialSymbol ?? '');
  const form = useAlertForm(symbol, resumed ?? undefined);
  const { condition, target, repeat } = form;
  const [invalid, setInvalid] = useState(false);
  const stock = stocks.data?.find((s) => s.symbol === symbol);
  const quote = form.quote ?? stock?.quote;
  const trade = quote ? toTradeQuote(quote) : null;
  const lastTicks = trade?.lastTicks ?? null;

  useEffect(() => {
    if (form.status === 'success') onClose();
  }, [form.status, onClose]);

  const error = invalid
    ? m.alerts.targetInvalid
    : form.issue
      ? copy.alertIssue(form.issue, symbol).explanation
      : form.limitReached !== null
        ? t.alerts.limitReached({ max: f.number(form.limitReached) })
        : form.failed
          ? m.alerts.createError
          : undefined;
  const moveBps = trade ? changeBps(trade.prevCloseTicks, trade.lastTicks) : bps(0);

  return {
    symbol,
    condition,
    target,
    repeat,
    error,
    sending: form.status === 'pending',
    symbols: (stocks.data ?? []).map((s) => ({
      value: s.symbol,
      label: `${s.symbol} · ${s.name}`,
    })),
    stock: stock ? { symbol: stock.symbol, sector: stock.sector } : null,
    now:
      quote && lastTicks !== null
        ? t.alerts.now({
            price: f.price(lastTicks),
            change: `${DIRECTION_ARROW[direction(moveBps)]} ${f.percent(moveBps, { signed: true })}`,
          })
        : null,
    currency: f.currencyAffix(),
    hint: alertTargetHint(form.request, lastTicks, copy),
    labels: {
      title: symbol ? t.alerts.newAlertFor({ symbol }) : t.alerts.newAlert,
      stock: m.alerts.stock,
      chooseStock: m.alerts.chooseStock,
      condition: t.alerts.columns.condition,
      conditions: t.alerts.conditions,
      target: condition === 'move_today' ? t.alerts.targetMove : t.alerts.targetPrice,
      repeat: t.alerts.repeat,
      once: t.alerts.repeats.once,
      every: t.alerts.everyWithCooldown({
        duration: t.common.minutes(f.count(POLICY.alertCooldownMs / 60_000)),
      }),
      cancel: t.common.cancel,
      create: t.alerts.create,
    },
    actions: {
      setSymbol: (next: string) => {
        setSymbol(next);
        form.reset();
      },
      setCondition: (next: AlertCondition) => {
        form.setCondition(next);
        setInvalid(false);
      },
      setTarget: (next: string) => {
        form.setTarget(next);
        setInvalid(false);
      },
      setRepeat: form.setRepeat,
      submit: () => {
        setInvalid(!form.submit());
      },
    },
  };
}
