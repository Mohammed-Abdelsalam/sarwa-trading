import { useMemo } from 'react';

import { type RejectionWire } from '@sarwa/contracts';
import { type AlertIssue } from '@sarwa/domain';
import {
  alertIssueMessage,
  createFormatter,
  DEFAULT_DIGITS,
  DIGITS,
  getMessages,
  isRtl,
  type Locale,
  LOCALES,
  rejectionMessage,
} from '@sarwa/i18n';

import { type TicketBlock } from '../ticket';
import { usePreference } from './preferences';

// Language and digit style are per-device preferences, shared by every screen through the cache.
export function useI18n() {
  const locale = usePreference('sarwa.locale', LOCALES, 'en' satisfies Locale);
  const digits = usePreference('sarwa.digits', DIGITS, DEFAULT_DIGITS);

  return useMemo(() => {
    const options = { locale: locale.value, digits: digits.value };
    return {
      ...options,
      dir: isRtl(locale.value) ? ('rtl' as const) : ('ltr' as const),
      t: getMessages(locale.value),
      f: createFormatter(options),
      isLoaded: locale.isLoaded && digits.isLoaded,
      setLocale: locale.setValue,
      setDigits: digits.setValue,
      // A wire rejection is the domain one without its unit brands (see toDomain in contracts).
      rejection: (rejection: TicketBlock | RejectionWire, symbol: string) =>
        rejectionMessage(rejection as TicketBlock, locale.value, digits.value, { symbol }),
      alertIssue: (issue: AlertIssue, symbol: string) =>
        alertIssueMessage(issue, locale.value, digits.value, { symbol }),
    };
  }, [
    locale.value,
    locale.isLoaded,
    locale.setValue,
    digits.value,
    digits.isLoaded,
    digits.setValue,
  ]);
}

export type I18n = ReturnType<typeof useI18n>;
