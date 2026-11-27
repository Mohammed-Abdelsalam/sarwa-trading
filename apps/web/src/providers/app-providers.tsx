'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useEffect, useEffectEvent, useState } from 'react';

import { type Notification as TradingNotification } from '@sarwa/contracts';
import {
  type SarwaClientOptions,
  notificationText,
  queryKeys,
  SarwaProvider,
  shouldRetry,
  useMarketConnection,
  useSarwa,
  useSyncStocksOnChange,
  useAuthSync,
  useTradingEvents,
} from '@sarwa/core';
import { usePageLifecycle } from '@sarwa/ui';
import { type LocalePreferences, PREFERENCE_COOKIES } from '@sarwa/ui/locale-cookie';

import { ToastHost } from '../components/layout/toast-host';
import { SignedOutHost } from '../features/account/signed-out-dialog';
import { useSuspendedRedirect } from '../features/account/use-suspended-page';
import { AuthGateHost } from '../features/gating/auth-gate-dialog';
import { AuthUiProvider } from '../features/gating/auth-ui';
import { createBrowserClient } from '../lib/client';
import { useCopy } from '../lib/i18n';

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

function SessionSync() {
  useAuthSync();
  useSuspendedRedirect();
  return null;
}

// Customer accounts: session restore, the sign-in gate, resumed intents and the signed-out notice.
function Accounts({ children }: { children: ReactNode }) {
  const { auth } = useSarwa();
  if (!auth) return children;
  return (
    <AuthUiProvider>
      <SessionSync />
      {/* First, so the layout's HydrationBoundary fills the stock list before the gate reads it. */}
      {children}
      <AuthGateHost />
      <SignedOutHost />
    </AuthUiProvider>
  );
}

export function AppProviders({
  preferences,
  initialStatus,
  children,
}: {
  preferences: LocalePreferences;
  // From the server's cookie read: a guest paints the guest view at once, in the HTML.
  initialStatus?: SarwaClientOptions['initialStatus'];
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
  const [client] = useState(() => createBrowserClient(initialStatus));

  return (
    <QueryClientProvider client={queryClient}>
      <SarwaProvider client={client}>
        <LiveSync />
        <DocumentLocale />
        <BrowserNotifications />
        <ToastHost>
          <Accounts>{children}</Accounts>
        </ToastHost>
      </SarwaProvider>
    </QueryClientProvider>
  );
}
