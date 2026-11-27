import './globals.css';

import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import { type Metadata, type Viewport } from 'next';
import { IBM_Plex_Sans_Arabic, Inter, JetBrains_Mono, Manrope } from 'next/font/google';
import { cookies, headers } from 'next/headers';
import { type ReactNode } from 'react';

import { CSRF_COOKIE } from '@sarwa/contracts';
import { isRtl, queryKeys } from '@sarwa/core/server';
import { themes } from '@sarwa/tokens';
import { readLocalePreferences } from '@sarwa/ui/locale-cookie';

import { AppShell } from '../components/layout/app-shell';
import { appMessages } from '../lib/messages';
import { serverCopy, siteJsonLd, SITE_URL } from '../lib/seo';
import { getStocks, getTradingStatus } from '../lib/server-api';
import { themeScript } from '../lib/theme-script';
import { AppProviders } from '../providers/app-providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
// Manrope only sets headings (700) and the logo and avatars (800).
const manrope = Manrope({ subsets: ['latin'], weight: ['700', '800'], variable: '--font-manrope' });
// Only the Latin faces every first paint needs are preloaded; mono (order ids, kbd) and Arabic
// (one locale) download on first use instead of competing with them.
const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  preload: false,
});
const arabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-arabic',
  preload: false,
});

export async function generateMetadata(): Promise<Metadata> {
  const { locale, m } = await serverCopy();
  const { siteName, description } = m.seo;
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: siteName, template: `%s · ${siteName}` },
    description,
    openGraph: {
      type: 'website',
      siteName,
      title: siteName,
      description,
      locale: locale === 'ar' ? 'ar_AE' : 'en_US',
    },
    twitter: { card: 'summary_large_image', title: siteName, description },
  };
}

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
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
  const nonce = requestHeaders.get('x-nonce') ?? undefined;
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
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: siteJsonLd(appMessages[preferences.locale].seo.siteName),
          }}
        />
      </head>
      <body className="flex min-h-dvh flex-col" suppressHydrationWarning>
        <AppProviders
          preferences={preferences}
          initialStatus={cookieStore.has(CSRF_COOKIE) ? 'loading' : 'guest'}
        >
          <HydrationBoundary state={dehydrate(queryClient)}>
            <AppShell>{children}</AppShell>
          </HydrationBoundary>
        </AppProviders>
      </body>
    </html>
  );
}
