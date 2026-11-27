import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

import { type Locale, useI18n } from '@sarwa/core';
import { PREFERENCE_COOKIES, writePreferenceCookie } from '@sarwa/ui/locale-cookie';

import { appMessages } from './messages';

// Shared catalog (t), number/date formatter (f) and the web-only catalog (m) in one object.
export function useCopy() {
  const i18n = useI18n();
  return { ...i18n, m: appMessages[i18n.locale] };
}

export type Copy = ReturnType<typeof useCopy>;

// Titles, breadcrumbs and JSON-LD are server-rendered, so the cookie must change before the refresh.
export function useSwitchLocale() {
  const { setLocale } = useI18n();
  const router = useRouter();
  return useCallback(
    (locale: Locale) => {
      writePreferenceCookie(PREFERENCE_COOKIES.locale, locale);
      setLocale(locale);
      router.refresh();
    },
    [setLocale, router],
  );
}
