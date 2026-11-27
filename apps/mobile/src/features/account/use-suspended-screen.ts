import { router } from 'expo-router';
import { Linking } from 'react-native';

import { useSession } from '@sarwa/core';

import { useCopy } from '../../lib/i18n';
import { type SuspendedView } from './session-ended';

export function useSuspendedScreen(): SuspendedView {
  const { t, f } = useCopy();
  const { suspension, acknowledge } = useSession();

  return {
    reason: suspension
      ? {
          category: t.suspended.reasonCategories[suspension.reasonCategory],
          text: suspension.reason,
          date: f.date(suspension.at),
        }
      : undefined,
    handle: suspension?.accountHandle,
    supportEmail: t.support.email,
    onContactSupport: () => {
      void Linking.openURL(`mailto:${t.support.email}`).catch(() => undefined);
    },
    onBrowseAsGuest: () => {
      acknowledge();
      router.replace('/(tabs)');
    },
  };
}
