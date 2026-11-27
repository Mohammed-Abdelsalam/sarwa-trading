import { router } from 'expo-router';

import { POLICY, useSession } from '@sarwa/core';

import { useCopy } from '../../lib/i18n';

export type MemberStatus = 'loading' | 'guest' | 'member';

function memberStatus(loading: boolean, isGuest: boolean): MemberStatus {
  if (isGuest) return 'guest';
  return loading ? 'loading' : 'member';
}

export function useGuestCta() {
  const { f } = useCopy();
  const { status, isGuest } = useSession();
  return {
    status: memberStatus(status === 'loading', isGuest),
    startingCash: f.money(POLICY.startingCashCents, { whole: true }),
    onCreateAccount: () => {
      router.push('/sign-up');
    },
    onSignIn: () => {
      router.push('/sign-in');
    },
  };
}
