import './globals.css';

import { type Metadata, type Viewport } from 'next';
import { Inter, JetBrains_Mono, Manrope } from 'next/font/google';
import { type ReactNode } from 'react';

import { themes } from '@sarwa/tokens';

import { AppShell } from '../components/layout/app-shell';
import { themeScript } from '../lib/theme-script';
import { AppProviders } from '../providers/app-providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const manrope = Manrope({ subsets: ['latin'], weight: ['700', '800'], variable: '--font-manrope' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' });

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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${manrope.variable} ${mono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-dvh flex-col" suppressHydrationWarning>
        <AppProviders>
          <AppShell>{children}</AppShell>
        </AppProviders>
      </body>
    </html>
  );
}
