import { cents, digitOptions, languageOptions, usePortfolio } from '@sarwa/core';

import { useNotificationPermission } from '../../lib/browser';
import { useCopy } from '../../lib/i18n';
import { useTheme } from '../../lib/theme';

export function useSettingsPage() {
  const copy = useCopy();
  const { t, f, m, locale, digits, setLocale, setDigits } = copy;
  const { theme, toggle } = useTheme();
  const { permission, request } = useNotificationPermission();
  const { books } = usePortfolio();
  const account = books?.account;

  return {
    theme,
    locale,
    digits,
    permission,
    account: account
      ? [
          { label: m.settings.accountId, value: account.handle },
          { label: t.portfolio.cash, value: f.money(cents(account.cashCents)) },
        ]
      : [],
    labels: {
      title: t.settings.title,
      appearance: t.settings.appearance,
      theme: t.settings.theme,
      themes: [
        { value: 'light' as const, label: t.settings.themes.light },
        { value: 'dark' as const, label: t.settings.themes.dark },
      ],
      languageRegion: t.settings.languageRegion,
      language: t.settings.language,
      languages: languageOptions(copy),
      digits: t.settings.digits,
      digitOptions: digitOptions(copy),
      notifications: m.settings.notifications,
      permission: {
        granted: m.settings.notificationsOn,
        denied: m.settings.notificationsBlocked,
        unsupported: m.settings.notificationsUnsupported,
        default: `${t.alerts.browserPermissionTitle} ${t.alerts.browserPermissionBody}`,
      },
      enable: t.common.enable,
      account: m.settings.account,
      disclosure: t.paper.disclosure,
    },
    actions: {
      setTheme: (next: 'light' | 'dark') => {
        if (next !== theme) toggle();
      },
      setLocale,
      setDigits,
      enableNotifications: request,
    },
  };
}
