import { useI18n } from '@sarwa/core';

import { appMessages } from './messages';

export type I18n = ReturnType<typeof useI18n>;
export type Copy = I18n & { m: (typeof appMessages)['en'] };

const ARABIC_INDIC_ZERO = 0x0660;

export function useCopy(): Copy {
  const i18n = useI18n();
  return { ...i18n, m: appMessages[i18n.locale] };
}

// Typed text (e.g. "12.5") keeps its exact shape on screen, only its digits follow the setting.
export function localDigits(text: string, digits: I18n['digits']): string {
  if (digits !== 'arab') return text;
  return text.replace(/[0-9]/g, (d) => String.fromCharCode(ARABIC_INDIC_ZERO + Number(d)));
}
