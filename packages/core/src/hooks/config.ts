import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { useStore } from 'zustand';

import { type AppConfig, type Period, PERIODS } from '@sarwa/contracts';

import { useSarwa } from '../provider';
import { type AppNotice, appNotices } from '../status';
import { useI18n } from './i18n';
import { queryKeys } from './keys';
import { useConnection, useMarketStatus } from './live';

export function useAppNotices(): { notices: AppNotice[]; dismiss: (notice: AppNotice) => void } {
  const i18n = useI18n();
  const connection = useConnection();
  const market = useMarketStatus();
  const banner = useAppConfig()?.banner;
  const [dismissed, setDismissed] = useState<string | null>(null);
  const cachedAt = useQueryClient().getQueryState(queryKeys.stocks)?.dataUpdatedAt;

  return {
    notices: appNotices(i18n, {
      connection,
      market,
      banner: banner?.message === dismissed ? null : banner,
      cachedAt: cachedAt === 0 ? undefined : cachedAt,
    }),
    dismiss: (notice) => {
      setDismissed(notice.message);
    },
  };
}

export function useRefreshAppConfig({ every }: { every?: number } = {}): () => void {
  const queryClient = useQueryClient();
  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.appConfig });
  }, [queryClient]);

  useEffect(() => {
    if (!every) return;
    const timer = setInterval(refresh, every);
    return () => {
      clearInterval(timer);
    };
  }, [every, refresh]);

  return refresh;
}

export function useEnabledPeriods(): readonly Period[] {
  return useAppConfig()?.enabledPeriods ?? PERIODS;
}

export function useAppConfig(): AppConfig | undefined {
  const { api, store } = useSarwa();
  const live = useStore(store, (state) => state.appConfig);
  const { data } = useQuery({
    queryKey: queryKeys.appConfig,
    queryFn: ({ signal }) => api.getAppConfig({ signal }),
    staleTime: 60_000,
  });
  if (!live) return data;
  if (!data) return live;
  return live.updatedAt >= data.updatedAt ? live : data;
}
