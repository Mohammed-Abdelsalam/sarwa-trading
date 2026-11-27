import { router } from 'expo-router';

import { POLICY, useSession, useSessions, useSignOut } from '@sarwa/core';

import { useCopy } from '../../lib/i18n';
import { showToast } from '../../lib/toast';
import { type GuestAccountView } from '../gating/guest-views';
import { type SignedInAccountView } from './signed-in-account';

const openSettings = () => {
  router.push('/settings');
};

export function useSignedInAccountScreen(): SignedInAccountView | null {
  const { t, f, locale } = useCopy();
  const { user } = useSession();
  const sessions = useSessions();
  const { signOut } = useSignOut();
  if (!user) return null;
  const devices = sessions.others.length + (sessions.current ? 1 : 0);

  return {
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    handle: user.account.handle,
    devices: devices > 0 ? t.counts.devices(f.count(devices)) : '',
    language: t.settings.languages[locale],
    theme: t.settings.themes.system,
    onPersonalInfo: () => {
      router.push('/account/profile');
    },
    onSecurity: () => {
      router.push('/account/security');
    },
    onNotifications: openSettings,
    onLanguage: openSettings,
    onAppearance: openSettings,
    onTrading: openSettings,
    onReset: () => {
      router.push('/account/reset');
    },
    onSignOut: () => {
      signOut();
      showToast(t.toasts.signedOut);
    },
    onDelete: () => {
      router.push('/account/delete');
    },
  };
}

export function useGuestAccountScreen(): GuestAccountView {
  const { t, f, locale } = useCopy();
  return {
    startingCash: f.money(POLICY.startingCashCents, { whole: true }),
    language: t.settings.languages[locale],
    theme: t.settings.themes.system,
    onCreateAccount: () => {
      router.push('/sign-up');
    },
    onSignIn: () => {
      router.push('/sign-in');
    },
    onLanguage: openSettings,
    onTheme: openSettings,
    onAbout: openSettings,
  };
}
