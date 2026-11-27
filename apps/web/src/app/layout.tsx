import './globals.css';

import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import { type Metadata, type Viewport } from 'next';
import { IBM_Plex_Sans_Arabic, Inter, JetBrains_Mono, Manrope } from 'next/font/google';
import { cookies } from 'next/headers';
import { type ReactNode } from 'react';

import { isRtl, queryKeys } from '@sarwa/core/server';
import { themes } from '@sarwa/tokens';

import { AppShell } from '../components/layout/app-shell';
import { readLocalePreferences } from '../lib/locale-cookie';
import { getStocks, getTradingStatus } from '../lib/server-api';
import { themeScript } from '../lib/theme-script';
import { AppProviders } from '../providers/app-providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const manrope = Manrope({ subsets: ['latin'], weight: ['700', '800'], variable: '--font-manrope' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' });
const arabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-arabic',
});

export const metadata: Metadata = {
  title: { default: 'Mini Trading', template: '%s · Mini Trading' },
  description: 'Live US stock prices, charts and a personal watchlist.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: themes.light.bg },
    { media: '(prefers-color-scheme: dark)', color: themes.dark.bg },
  ],
};

// The nav (palette, account menu) and the pages all read the stock list, so it is prefetched once
// here, above all of them: a boundary lower down can't fill a query the nav already created empty.
// The trading status comes along so no ticket renders before the rules are known.
export default async function RootLayout({ children }: { children: ReactNode }) {
  // Reading the cookies renders per request (language and digits); the market data itself comes
  // from a short-lived snapshot cache, see server-api.
  const cookieStore = await cookies();
  const preferences = readLocalePreferences((name) => cookieStore.get(name)?.value);
  const queryClient = new QueryClient();
  // If the API is down the page still renders and the client retries.
  await Promise.all([
    queryClient.query({ queryKey: queryKeys.stocks, queryFn: getStocks }).catch(() => undefined),
    queryClient
      .query({ queryKey: queryKeys.tradingStatus, queryFn: getTradingStatus })
      .catch(() => undefined),
  ]);

  return (
    <html
      lang={preferences.locale}
      dir={isRtl(preferences.locale) ? 'rtl' : 'ltr'}
      suppressHydrationWarning
      className={`${inter.variable} ${manrope.variable} ${mono.variable} ${arabic.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-dvh flex-col" suppressHydrationWarning>
        <AppProviders preferences={preferences}>
          <HydrationBoundary state={dehydrate(queryClient)}>
            <AppShell>{children}</AppShell>
          </HydrationBoundary>
        </AppProviders>
      </body>
    </html>
  );
}
