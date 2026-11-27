import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';

import {
  alertDetail,
  alertRuleText,
  alertState,
  useAlerts,
  useDeleteAlert,
  useQuotes,
  useStockIndex,
  useUpdateAlert,
} from '@sarwa/core';

import { useCopy } from '../../lib/i18n';

export type { AlertState } from '@sarwa/core';

export function useAlertsScreen(initialSymbol?: string) {
  const copy = useCopy();
  const { t, f } = copy;
  const alerts = useAlerts();
  const update = useUpdateAlert();
  const remove = useDeleteAlert();
  const { sectorOf } = useStockIndex();
  const items = useMemo(() => alerts.data?.items ?? [], [alerts.data]);
  const symbols = useMemo(() => [...new Set(items.map((a) => a.symbol))], [items]);
  const quotes = useQuotes(symbols);
  const [creating, setCreating] = useState<string | null>(initialSymbol ?? null);

  return {
    count: alerts.data
      ? t.alerts.countShort({
          n: f.number(alerts.data.activeCount),
          max: f.number(alerts.data.limit),
        })
      : '',
    rows: items.map((alert) => ({
      id: alert.id,
      symbol: alert.symbol,
      sector: sectorOf(alert.symbol),
      condition: alert.condition,
      enabled: alert.enabled,
      rule: alertRuleText(alert, copy),
      detail: alertDetail(alert, quotes[alert.symbol], copy),
      repeat: alert.repeat === 'every' ? t.alerts.recurring : t.alerts.repeats.once,
      state: alertState(alert),
    })),
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
