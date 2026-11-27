'use client';

import './globals.css';

import { TriangleAlert } from 'lucide-react';
import { useSyncExternalStore } from 'react';

import { getMessages, isRtl, type Locale } from '@sarwa/core/server';
import { Button, StateView } from '@sarwa/ui';

import { readLocalePreferences } from '../lib/locale-cookie';

const noSubscribe = () => () => undefined;

function cookieLocale(): Locale {
  const cookies = new URLSearchParams(document.cookie.replaceAll('; ', '&'));
  return readLocalePreferences((name) => cookies.get(name) ?? undefined).locale;
}

// Replaces the root layout when it fails, so it has no providers: the language comes from the cookie.
export default function GlobalError({ retry }: { error: Error; retry: () => void }) {
  const locale = useSyncExternalStore(noSubscribe, cookieLocale, (): Locale => 'en');
  const copy = getMessages(locale).errorPage;
  return (
    <html lang={locale} dir={isRtl(locale) ? 'rtl' : 'ltr'}>
      <body className="flex min-h-dvh items-center justify-center">
        <title>{copy.title}</title>
        <StateView
          tone="neg"
          icon={<TriangleAlert />}
          title={copy.title}
          description={copy.body}
          action={
            <Button
              onClick={() => {
                retry();
              }}
            >
              {copy.retry}
            </Button>
          }
        />
      </body>
    </html>
  );
}
