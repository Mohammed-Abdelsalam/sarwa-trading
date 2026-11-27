import { type Locale } from './locale';
import { ar } from './messages/ar';
import { en, type Messages } from './messages/en';

const CATALOGS: Record<Locale, Messages> = { en, ar };

export function getMessages(locale: Locale): Messages {
  return CATALOGS[locale];
}
