import './globals.css';

import { type Metadata, type Viewport } from 'next';
import { Inter, JetBrains_Mono, Manrope } from 'next/font/google';
import { cookies, headers } from 'next/headers';
import { type ReactNode } from 'react';

import { isRtl } from '@sarwa/core/server';
import { themes } from '@sarwa/tokens';
import { PREFERENCE_COOKIES, readLocalePreferences } from '@sarwa/ui/locale-cookie';

import { themeScript } from '../lib/theme-script';
import { AppProviders } from '../providers/app-providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const manrope = Manrope({ subsets: ['latin'], weight: ['700', '800'], variable: '--font-manrope' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' });

export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s · Mini Trading Admin' },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: themes.light.bg },
    { media: '(prefers-color-scheme: dark)', color: themes.dark.bg },
  ],
};

// Reading the nonce and the language cookie renders every page per request; behind a login,
// prerendering gained little.
export default async function RootLayout({ children }: { children: ReactNode }) {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
  const nonce = requestHeaders.get('x-nonce') ?? undefined;
  const preferences = readLocalePreferences((name) => cookieStore.get(name)?.value);
  return (
    <html
      lang={preferences.locale}
      dir={isRtl(preferences.locale) ? 'rtl' : 'ltr'}
      suppressHydrationWarning
      className={`${inter.variable} ${manrope.variable} ${mono.variable}`}
    >
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh" suppressHydrationWarning>
        <AppProviders
          preferences={cookieStore.has(PREFERENCE_COOKIES.locale) ? preferences : undefined}
        >
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
