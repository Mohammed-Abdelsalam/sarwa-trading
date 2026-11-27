import { useEffect, useState } from 'react';

import { type Alert, type CreateAlertRequest } from '@sarwa/contracts';
import {
  absolute,
  bps,
  changeBps,
  direction,
  DIRECTION_ARROW,
  negate,
  parseCents,
  parseTicks,
  POLICY,
  toTradeQuote,
  useCreateAlert,
  useQuote,
  useStocks,
} from '@sarwa/core';

import { type Copy, useCopy } from '../../lib/i18n';

export type AlertCondition = Alert['condition'];
export type AlertRepeat = Alert['repeat'];

// The typed target as the request the API takes, or null when the text isn't a number.
export function alertRequest(form: {
  symbol: string;
  condition: AlertCondition;
  target: string;
  repeat: AlertRepeat;
}): CreateAlertRequest | null {
  const { symbol, condition, repeat } = form;
  if (condition === 'move_today') {
    // A percent with two decimals has the cents scale: "-5.25" → −525 bps.
    const [, sign, digits = ''] = /^\s*([-+]?)(.*)$/.exec(form.target) ?? [];
    const unsigned = parseCents(digits);
    const bps = unsigned === null ? null : sign === '-' ? negate(unsigned) : unsigned;
    return bps === null ? null : { symbol, condition, repeat, thresholdBps: bps };
  }
  const ticks = parseTicks(form.target);
  return ticks === null ? null : { symbol, condition, repeat, thresholdTicks: ticks };
}

function targetHint(request: CreateAlertRequest | null, lastTicks: number | null, { t, f }: Copy) {
  if (!request?.thresholdTicks || lastTicks === null) return undefined;
  const move = changeBps(lastTicks, request.thresholdTicks);
  const pct = f.percent(absolute(move));
  return move >= 0 ? t.alerts.aboveCurrent({ pct }) : t.alerts.belowCurrent({ pct });
}

export function useAlertDialog({
  initialSymbol,
  onClose,
}: {
  initialSymbol: string | null;
  onClose: () => void;
}) {
  const copy = useCopy();
  const { t, f, m } = copy;
  const stocks = useStocks();
  const create = useCreateAlert();
  const [symbol, setSymbol] = useState(initialSymbol ?? '');
  const [condition, setCondition] = useState<AlertCondition>('price_above');
  const [target, setTarget] = useState('');
  const [repeat, setRepeat] = useState<AlertRepeat>('once');
  const [invalid, setInvalid] = useState(false);
  const stock = stocks.data?.find((s) => s.symbol === symbol);
  const quote = useQuote(symbol) ?? stock?.quote;
  const trade = quote ? toTradeQuote(quote) : null;
  const lastTicks = trade?.lastTicks ?? null;
  const request = symbol ? alertRequest({ symbol, condition, target, repeat }) : null;

  useEffect(() => {
    if (create.status === 'success') onClose();
  }, [create.status, onClose]);

  const error = invalid
    ? m.alerts.targetInvalid
    : create.issue
      ? copy.alertIssue(create.issue, symbol).explanation
      : create.status === 'error'
        ? m.alerts.createError
        : undefined;
  const moveBps = trade ? changeBps(trade.prevCloseTicks, trade.lastTicks) : bps(0);

  return {
    symbol,
    condition,
    target,
    repeat,
    error,
    sending: create.status === 'pending',
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
    hint: condition === 'move_today' ? undefined : targetHint(request, lastTicks, copy),
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
        create.reset();
      },
      setCondition: (next: AlertCondition) => {
        setCondition(next);
        setInvalid(false);
        create.reset();
      },
      setTarget: (next: string) => {
        setTarget(next);
        setInvalid(false);
        create.reset();
      },
      setRepeat,
      submit: () => {
        if (!request) {
          setInvalid(true);
          return;
        }
        create.create(request);
      },
    },
  };
}
