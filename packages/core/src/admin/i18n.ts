import { useMemo } from 'react';

import { type HaltDuration } from '@sarwa/contracts';
import { getAdminMessages } from '@sarwa/i18n';

import { useI18n } from '../hooks/i18n';

// The shared copy plus the dashboard's own catalog under t.admin.
export function useAdminI18n() {
  const i18n = useI18n();
  return useMemo(
    () => ({ ...i18n, t: { ...i18n.t, admin: getAdminMessages(i18n.locale) } }),
    [i18n],
  );
}

export type AdminI18n = ReturnType<typeof useAdminI18n>;

export function haltDurationLabel(duration: HaltDuration, { t, f }: Pick<AdminI18n, 't' | 'f'>) {
  switch (duration) {
    case '5m':
      return t.common.minutes(f.count(5));
    case '15m':
      return t.common.minutes(f.count(15));
    case 'until_close':
    case 'manual':
      return t.admin.trading.durations[duration];
  }
}
