'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useEffect, useEffectEvent, useState } from 'react';

import { type Notification as TradingNotification } from '@sarwa/contracts';
import {
  notificationText,
  queryKeys,
  SarwaProvider,
  shouldRetry,
  useMarketConnection,
  useSarwa,
  useSyncStocksOnChange,
  useTradingEvents,
} from '@sarwa/core';

import { usePageLifecycle } from '../lib/browser';
import { createBrowserClient } from '../lib/client';
import { useCopy } from '../lib/i18n';
import { type LocalePreferences, PREFERENCE_COOKIES } from '../lib/locale-cookie';

function LiveSync() {
  useMarketConnection(usePageLifecycle());
  useSyncStocksOnChange();
  useTradingEvents();
  return null;
}

// The server sets <html lang dir> from the cookie; this keeps it in step when the user switches.
function DocumentLocale() {
  const { locale, dir } = useCopy();
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale, dir]);
  return null;
}

// Rides the same socket events as the in-app bell; the OS notification only shows for a hidden tab.
function BrowserNotifications() {
  const { market } = useSarwa();
  const copy = useCopy();
  const show = useEffectEvent((notification: TradingNotification) => {
    const { title, body } = notificationText(notification.payload, copy);
    // Android Chrome only allows notifications from a service worker; the in-app bell still has it.
    try {
      new Notification(title, { body, tag: notification.id });
    } catch {
      return;
    }
  });

  useEffect(
    () =>
      market.onTradingEvent((event) => {
        if (event.name !== 'notification' || !document.hidden) return;
        if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
        show(event.payload.notification);
      }),
    [market],
  );
  return null;
}

export function AppProviders({
  preferences,
  children,
}: {
  preferences: LocalePreferences;
  children: ReactNode;
}) {
  const [queryClient] = useState(() => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: shouldRetry, staleTime: 30_000 } },
    });
    // Seeded from the server's cookie read, so the first client render matches the server's.
    client.setQueryData(queryKeys.preference(PREFERENCE_COOKIES.locale), preferences.locale);
    client.setQueryData(queryKeys.preference(PREFERENCE_COOKIES.digits), preferences.digits);
    return client;
  });
  const [client] = useState(createBrowserClient);

  return (
    <QueryClientProvider client={queryClient}>
      <SarwaProvider client={client}>
        <LiveSync />
        <DocumentLocale />
        <BrowserNotifications />
        {children}
      </SarwaProvider>
    </QueryClientProvider>
  );
}
