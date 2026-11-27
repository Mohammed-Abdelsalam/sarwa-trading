import { useState } from 'react';

import { type Alert, type StockWithQuote } from '@sarwa/contracts';
import {
  absolute,
  alertRuleText,
  changeBps,
  ticks,
  toTradeQuote,
  useAlerts,
  useDeleteAlert,
  useStocks,
  useUpdateAlert,
} from '@sarwa/core';

import { replaceSearchParam, useNotificationPermission, useSearchParam } from '../../lib/browser';
import { type Copy, useCopy } from '../../lib/i18n';

export type AlertState = 'active' | 'paused' | 'triggered';

export function alertState(alert: Alert): AlertState {
  if (!alert.enabled) return 'paused';
  return !alert.armed && alert.lastFiredAt !== null ? 'triggered' : 'active';
}

export function alertRow(alert: Alert, stock: StockWithQuote | undefined, copy: Copy) {
  const { t, f, m } = copy;
  const state = alertState(alert);
  const quote = stock ? toTradeQuote(stock.quote) : null;
  let distance = '';
  if (state === 'triggered' && alert.lastFiredAt !== null) {
    distance = t.alerts.triggeredAt({
      time: f.time(alert.lastFiredAt),
      price: alert.thresholdTicks === null ? '—' : f.price(ticks(alert.thresholdTicks)),
    });
  } else if (alert.condition === 'move_today' && quote) {
    distance = m.alerts.todayMove({
      pct: f.percent(changeBps(quote.prevCloseTicks, quote.lastTicks), { signed: true }),
    });
  } else if (quote && alert.thresholdTicks !== null) {
    distance = t.alerts.away({
      price: f.price(quote.lastTicks),
      pct: f.percent(absolute(changeBps(quote.lastTicks, alert.thresholdTicks))),
    });
  }
  return {
    id: alert.id,
    symbol: alert.symbol,
    sector: stock?.sector ?? 'tech',
    enabled: alert.enabled,
    condition: alertRuleText(alert, copy),
    distance,
    repeat: alert.repeat === 'every' ? t.alerts.recurring : t.alerts.repeats.once,
    state,
    stateLabel: t.alerts.states[state],
  };
}

export type AlertRow = ReturnType<typeof alertRow>;

export function useAlertsPage() {
  const copy = useCopy();
  const { t, f, m } = copy;
  const alerts = useAlerts();
  const stocks = useStocks();
  const update = useUpdateAlert();
  const remove = useDeleteAlert();
  const { permission, request } = useNotificationPermission();
  const requested = useSearchParam('new');
  const [manualOpen, setManualOpen] = useState(false);
  const bySymbol = new Map((stocks.data ?? []).map((stock) => [stock.symbol, stock]));
  const data = alerts.data;

  return {
    rows: (data?.items ?? []).map((alert) => alertRow(alert, bySymbol.get(alert.symbol), copy)),
    isLoading: alerts.isPending,
    isError: alerts.isError && !data,
    dialog: {
      open: manualOpen || requested !== null,
      symbol: requested?.toUpperCase() ?? null,
    },
    limitReached: data ? data.activeCount >= data.limit : false,
    priming: permission === 'default',
    labels: {
      title: t.alerts.title,
      subtitle: data
        ? `${t.alerts.activeOf({ n: f.number(data.activeCount), max: f.number(data.limit) })} · ${t.alerts.delivery}`
        : t.alerts.delivery,
      newAlert: t.alerts.newAlert,
      primingTitle: t.alerts.browserPermissionTitle,
      primingBody: t.alerts.browserPermissionBody,
      enable: t.common.enable,
      columns: { ...t.alerts.columns, status: m.alerts.status },
      actions: t.alerts.actionsA11y,
      resume: m.alerts.enable,
      pause: m.alerts.disable,
      delete: m.alerts.delete,
      empty: t.alerts.empty,
      loadError: m.alerts.loadError,
      retry: t.common.retry,
      limitReached: data ? t.alerts.limitReached({ max: f.number(data.limit) }) : '',
    },
    actions: {
      retry: () => void alerts.refetch(),
      enableNotifications: request,
      openDialog: () => {
        setManualOpen(true);
      },
      closeDialog: () => {
        setManualOpen(false);
        replaceSearchParam('new', null);
      },
      setEnabled: (id: string, enabled: boolean) => {
        update.mutate({ id, patch: { enabled } });
      },
      remove: (id: string) => {
        remove.mutate(id);
      },
    },
  };
}
