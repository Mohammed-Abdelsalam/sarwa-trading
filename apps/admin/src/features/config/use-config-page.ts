import { useState } from 'react';

import { BANNER_MAX_LENGTH, type BannerTone, type Period } from '@sarwa/contracts';
import {
  type ConfigDraft,
  configChanges,
  configToDraft,
  togglePeriod,
  useAdminConfig,
  useAdminSession,
  useAdminStats,
  useUpdateConfig,
} from '@sarwa/core/admin';

export function useConfigPage() {
  const { canEdit } = useAdminSession();
  const config = useAdminConfig();
  const stats = useAdminStats();
  const save = useUpdateConfig();
  const [edits, setEdits] = useState<Partial<ConfigDraft>>({});
  const current = config.data ? { ...configToDraft(config.data), ...edits } : null;
  const changes = config.data ? configChanges(config.data, edits) : { patch: {}, count: 0 };
  const edit = (patch: Partial<ConfigDraft>) => {
    setEdits((previous) => ({ ...previous, ...patch }));
  };

  return {
    canEdit,
    draft: current,
    changes: changes.count,
    maxLength: BANNER_MAX_LENGTH,
    clients: stats.data?.connectedClients ?? 0,
    isLoading: config.isPending,
    isError: config.isError,
    isSaving: save.isPending,
    failed: save.isError,
    actions: {
      retry: () => void config.refetch(),
      setMaintenance: (maintenanceMode: boolean) => {
        edit({ maintenanceMode });
      },
      setMessage: (bannerMessage: string) => {
        edit({ bannerMessage: bannerMessage.slice(0, BANNER_MAX_LENGTH) });
      },
      setTone: (bannerTone: BannerTone) => {
        edit({ bannerTone });
      },
      togglePeriod: (period: Period) => {
        if (current) edit({ enabledPeriods: togglePeriod(current.enabledPeriods, period) });
      },
      discard: () => {
        setEdits({});
      },
      save: () => {
        if (changes.count === 0) return;
        save.mutate(changes.patch, {
          onSuccess: () => {
            setEdits({});
          },
        });
      },
    },
  };
}

export type ConfigPageModel = ReturnType<typeof useConfigPage>;
