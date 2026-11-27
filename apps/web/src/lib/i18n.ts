import { useI18n } from '@sarwa/core';

import { appMessages } from './messages';

// Shared catalog (t), number/date formatter (f) and the web-only catalog (m) in one object.
export function useCopy() {
  const i18n = useI18n();
  return { ...i18n, m: appMessages[i18n.locale] };
}

export type Copy = ReturnType<typeof useCopy>;
