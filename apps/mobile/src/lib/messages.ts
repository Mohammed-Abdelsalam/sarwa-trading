import { type Locale } from '@sarwa/core';

// Mobile-only copy; everything shared comes from useI18n().t.
const en = {
  sharesAvg: ({ shares, price }: { shares: string; price: string }) =>
    `${shares} sh · avg ${price}`,
  viewAll: 'View all',
  loadFailed: "Couldn't load this",
  noActivity: 'No orders yet. Your trades will show up here.',
  pause: 'Pause',
  resume: 'Resume',
  delete: 'Delete',
  account: {
    paperAccount: 'Paper account',
    virtualStart: 'Virtual start',
  },
  alerts: {
    inAppOnly: 'Alerts arrive in-app only',
  },
};

export type AppMessages = typeof en;

const ar: AppMessages = {
  sharesAvg: ({ shares, price }) => `${shares} سهم · متوسط ${price}`,
  viewAll: 'عرض الكل',
  loadFailed: 'تعذّر التحميل',
  noActivity: 'لا توجد أوامر بعد. ستظهر صفقاتك هنا.',
  pause: 'إيقاف مؤقت',
  resume: 'استئناف',
  delete: 'حذف',
  account: {
    paperAccount: 'حساب تجريبي',
    virtualStart: 'الرصيد الافتراضي الأولي',
  },
  alerts: {
    inAppOnly: 'تصلك التنبيهات داخل التطبيق فقط',
  },
};

export const appMessages: Record<Locale, AppMessages> = { en, ar };
