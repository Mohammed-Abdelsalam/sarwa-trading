'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { type CustomerUser } from '@sarwa/contracts';
import { useSession } from '@sarwa/core';

import { AUTH_ROUTES } from '../auth/auth-view';
import { GuestEmptyState } from '../gating/guest-views';
import { usePersonalPage } from '../gating/use-personal-page';
import { PreferenceSettings } from '../settings/settings-page';
import { DangerSettingsPage } from './danger-zone';
import { SecuritySettingsPage } from './security-card';
import { SettingsLayout } from './settings-layout';
import { type SettingsSection } from './settings-sections';
import { useDangerPage } from './use-danger-page';
import { useSecurityPage } from './use-security-page';

function SecurityScreen({ user }: { user: CustomerUser }) {
  return <SecuritySettingsPage view={useSecurityPage(user)} />;
}

function DangerScreen() {
  return <DangerSettingsPage view={useDangerPage()} />;
}

// Security belongs to an account, so a guest is invited to make one there.
export function SettingsScreen({ section }: { section: Exclude<SettingsSection, 'profile'> }) {
  const { user } = useSession();
  const page = usePersonalPage('portfolio');
  const router = useRouter();
  const personal = section === 'security' || section === 'danger';
  const leave = section === 'danger' && page.status === 'guest';
  // Signing out or requesting deletion here ends the session; Home takes over as a guest.
  useEffect(() => {
    if (leave) router.replace(AUTH_ROUTES.home);
  }, [leave, router]);
  if (personal && page.status === 'member' && user)
    return section === 'security' ? <SecurityScreen user={user} /> : <DangerScreen />;
  return (
    <SettingsLayout section={section}>
      {!personal ? <PreferenceSettings section={section} /> : null}
      {section === 'security' && page.status === 'guest' ? (
        <GuestEmptyState kind="portfolio" onCreate={page.onCreate} onSignIn={page.onSignIn} />
      ) : null}
    </SettingsLayout>
  );
}
