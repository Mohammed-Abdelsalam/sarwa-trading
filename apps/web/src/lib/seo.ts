import { type Metadata } from 'next';
import { cookies } from 'next/headers';

import { type Stock } from '@sarwa/contracts';
import { getMessages } from '@sarwa/core/server';

import { readLocalePreferences } from './locale-cookie';
import { appMessages } from './messages';

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const PERSONAL_ROUTES = ['/portfolio', '/orders', '/watchlist', '/alerts', '/settings'];

// Server-rendered copy follows the same language cookie as the root layout.
export async function serverCopy() {
  const cookieStore = await cookies();
  const { locale } = readLocalePreferences((name) => cookieStore.get(name)?.value);
  return { locale, t: getMessages(locale), m: appMessages[locale] };
}

// Pages that only show this browser's own account: titled, but kept out of search.
export async function personalMetadata(
  page: 'portfolio' | 'orders' | 'watchlist' | 'alerts' | 'settings',
): Promise<Metadata> {
  const { t } = await serverCopy();
  const title = page === 'settings' ? t.settings.title : t.nav[page];
  return { title, robots: { index: false, follow: false } };
}

// '<' is escaped so a stock name can never close the script tag.
export function jsonLd(data: object): string {
  return JSON.stringify({ '@context': 'https://schema.org', ...data }).replace(/</g, '\\u003c');
}

export function siteJsonLd(name: string) {
  return jsonLd({
    '@graph': [
      { '@type': 'Organization', '@id': `${SITE_URL}/#org`, name, url: SITE_URL },
      {
        '@type': 'WebSite',
        name,
        url: SITE_URL,
        publisher: { '@id': `${SITE_URL}/#org` },
        potentialAction: {
          '@type': 'SearchAction',
          target: `${SITE_URL}/markets?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  });
}

export function stockJsonLd({ stock, marketsLabel }: { stock: Stock; marketsLabel: string }) {
  const url = `${SITE_URL}/stocks/${stock.symbol}`;
  return jsonLd({
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: marketsLabel, item: `${SITE_URL}/markets` },
          { '@type': 'ListItem', position: 2, name: stock.symbol, item: url },
        ],
      },
      {
        '@type': 'Corporation',
        name: stock.name,
        tickerSymbol: `${stock.exchange} ${stock.symbol}`,
        url,
      },
    ],
  });
}
