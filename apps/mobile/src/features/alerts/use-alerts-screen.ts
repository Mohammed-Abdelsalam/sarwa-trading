import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useStore } from 'zustand';

import { type Alert, type Quote } from '@sarwa/contracts';
import {
  absolute,
  alertRuleText,
  changeBps,
  ticks,
  toTradeQuote,
  useAlerts,
  useDeleteAlert,
  useLiveSymbols,
  useSarwa,
  useUpdateAlert,
} from '@sarwa/core';

import { type Copy, useCopy } from '../../lib/i18n';
import { useStockIndex } from '../../lib/sectors';

export type AlertState = 'active' | 'paused' | 'triggered';

function alertState(alert: Alert): AlertState {
  if (!alert.enabled) return 'paused';
  return !alert.armed && alert.lastFiredAt !== null ? 'triggered' : 'active';
}

function alertDetail(
  alert: Alert,
  state: AlertState,
  quote: Quote | undefined,
  copy: Copy,
): string {
  const { t, f } = copy;
  if (state === 'triggered' && alert.lastFiredAt !== null) {
    return t.alerts.triggeredAt({
      time: f.time(alert.lastFiredAt),
      price: f.price(ticks(alert.thresholdTicks ?? 0)),
    });
  }
  if (!quote) return '';
  const { lastTicks, prevCloseTicks } = toTradeQuote(quote);
  if (alert.condition === 'move_today') {
    return `${f.percent(changeBps(prevCloseTicks, lastTicks), { signed: true })} ${t.portfolio.today}`;
  }
  const target = alert.thresholdTicks ?? lastTicks;
  return t.alerts.away({
    price: f.price(lastTicks),
    pct: f.percent(absolute(changeBps(lastTicks, target))),
  });
}

export function useAlertsScreen(initialSymbol?: string) {
  const copy = useCopy();
  const { t, f } = copy;
  const { store } = useSarwa();
  const alerts = useAlerts();
  const update = useUpdateAlert();
  const remove = useDeleteAlert();
  const { sectorOf } = useStockIndex();
  const items = useMemo(() => alerts.data?.items ?? [], [alerts.data]);
  const symbols = useMemo(() => [...new Set(items.map((a) => a.symbol))], [items]);
  useLiveSymbols(symbols);
  const quotes = useStore(store, (state) => state.quotes);
  const [creating, setCreating] = useState<string | null>(initialSymbol ?? null);

  return {
    count: alerts.data
      ? t.alerts.countShort({
          n: f.number(alerts.data.activeCount),
          max: f.number(alerts.data.limit),
        })
      : '',
    rows: items.map((alert) => {
      const state = alertState(alert);
      return {
        id: alert.id,
        symbol: alert.symbol,
        sector: sectorOf(alert.symbol),
        condition: alert.condition,
        enabled: alert.enabled,
        rule: alertRuleText(alert, copy),
        detail: alertDetail(alert, state, quotes[alert.symbol], copy),
        repeat: alert.repeat === 'every' ? t.alerts.recurring : t.alerts.repeats.once,
        state,
      };
    }),
    creating,
    isLoading: alerts.isPending,
    isError: alerts.isError && !alerts.data,
    actions: {
      retry: () => void alerts.refetch(),
      closeCreate: () => {
        setCreating(null);
      },
      newAlert: () => {
        router.push({ pathname: '/search', params: { for: 'alert' } });
      },
      toggle: (id: string, enabled: boolean) => {
        void Haptics.selectionAsync();
        update.mutate({ id, patch: { enabled: !enabled } });
      },
      remove: (id: string) => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        remove.mutate(id);
      },
    },
  };
}
