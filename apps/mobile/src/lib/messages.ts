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
  alerts: {
    inAppOnly: 'Alerts arrive in-app only',
  },
  maintenance: {
    title: "We'll be right back",
    body: "Mini Trading is getting a scheduled upgrade. Your watchlist is saved and live prices return as soon as we're done.",
    checkAgain: 'Check again',
    autoRetry: ({ seconds }: { seconds: string }) =>
      `We'll also retry automatically every ${seconds} s.`,
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
  alerts: {
    inAppOnly: 'تصلك التنبيهات داخل التطبيق فقط',
  },
  maintenance: {
    title: 'سنعود قريبًا',
    body: 'يخضع Mini Trading لتحديث مجدول. قائمة المتابعة محفوظة، وستعود الأسعار المباشرة فور انتهائنا.',
    checkAgain: 'تحقّق مجددًا',
    autoRetry: ({ seconds }) => `سنعيد المحاولة تلقائيًا كل ${seconds} ث.`,
  },
};

export const appMessages: Record<Locale, AppMessages> = { en, ar };
