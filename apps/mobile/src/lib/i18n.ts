import { useI18n } from '@sarwa/core';

import { appMessages } from './messages';

export type I18n = ReturnType<typeof useI18n>;
export type Copy = I18n & { m: (typeof appMessages)['en'] };

export function useCopy(): Copy {
  const i18n = useI18n();
  return { ...i18n, m: appMessages[i18n.locale] };
}
