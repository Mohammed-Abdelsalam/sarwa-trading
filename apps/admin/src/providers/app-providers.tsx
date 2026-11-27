'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useEffect, useState } from 'react';

import { queryKeys, SarwaProvider, shouldRetry, useMarketConnection } from '@sarwa/core';
import { AdminProvider, useAdminI18n } from '@sarwa/core/admin';
import { usePageLifecycle } from '@sarwa/ui';
import { type LocalePreferences, PREFERENCE_COOKIES } from '@sarwa/ui/locale-cookie';

import { createBrowserClients } from '../lib/client';

function LiveSync() {
  useMarketConnection(usePageLifecycle());
  return null;
}

// The server sets <html lang dir> from the cookie; dialogs portal to <body>, so a switch must reach it.
function DocumentLocale() {
  const { locale, dir } = useAdminI18n();
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale, dir]);
  return null;
}

export function AppProviders({
  preferences,
  children,
}: {
  // From the server's cookie read; without a cookie the browser's saved choice is read instead.
  preferences?: LocalePreferences;
  children: ReactNode;
}) {
  const [queryClient] = useState(() => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: shouldRetry, staleTime: 15_000 } },
    });
    if (preferences) {
      client.setQueryData(queryKeys.preference(PREFERENCE_COOKIES.locale), preferences.locale);
      client.setQueryData(queryKeys.preference(PREFERENCE_COOKIES.digits), preferences.digits);
    }
    return client;
  });
  const [clients] = useState(createBrowserClients);

  return (
    <QueryClientProvider client={queryClient}>
      <SarwaProvider client={clients.sarwa}>
        <AdminProvider client={clients.admin}>
          <LiveSync />
          <DocumentLocale />
          {children}
        </AdminProvider>
      </SarwaProvider>
    </QueryClientProvider>
  );
}
