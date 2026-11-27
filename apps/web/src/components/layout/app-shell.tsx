'use client';

import { type ReactNode, Suspense } from 'react';

import { useAppConfig } from '@sarwa/core';

import { useCopy } from '../../lib/i18n';
import { AppBanners } from './app-banners';
import { MaintenanceScreen } from './maintenance-screen';
import { TopNav } from './top-nav';

export function AppShell({ children }: { children: ReactNode }) {
  const { m } = useCopy();
  const maintenance = useAppConfig()?.maintenanceMode ?? false;
  if (maintenance) return <MaintenanceScreen />;

  return (
    <>
      <a
        href="#main"
        className="bg-brand text-on-brand sr-only z-50 rounded-md px-4 py-2 font-semibold focus:not-sr-only focus:absolute focus:start-4 focus:top-3"
      >
        {m.nav.skip}
      </a>
      <Suspense>
        <TopNav />
      </Suspense>
      <AppBanners />
      <main id="main" className="flex min-h-0 flex-1 flex-col">
        {children}
      </main>
    </>
  );
}
