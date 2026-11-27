import { type Locale } from './locale';
import { adminAr } from './messages/admin-ar';
import { adminEn, type AdminMessages } from './messages/admin-en';
import { ar } from './messages/ar';
import { en, type Messages } from './messages/en';

const CATALOGS: Record<Locale, Messages> = { en, ar };
// A separate catalog, so the customer apps never ship the dashboard's copy.
const ADMIN_CATALOGS: Record<Locale, AdminMessages> = { en: adminEn, ar: adminAr };

export function getMessages(locale: Locale): Messages {
  return CATALOGS[locale];
}

export function getAdminMessages(locale: Locale): AdminMessages {
  return ADMIN_CATALOGS[locale];
}
