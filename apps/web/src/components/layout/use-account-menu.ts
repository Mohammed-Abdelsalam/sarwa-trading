import { type Route } from 'next';
import { useRouter } from 'next/navigation';

import { digitOptions, languageOptions, usePortfolio, useSession, useSignOut } from '@sarwa/core';

import { useCopy, useSwitchLocale } from '../../lib/i18n';
import { useTheme } from '../../lib/theme';

export function useAccountMenu() {
  const copy = useCopy();
  const { t, f, m, locale, digits, setDigits } = copy;
  const setLocale = useSwitchLocale();
  const router = useRouter();
  const { summary, books } = usePortfolio();
  const { theme, toggle } = useTheme();
  const { user } = useSession();
  const signOut = useSignOut();

  return {
    theme,
    user: user ? { name: user.name, email: user.email } : null,
    locale,
    digits,
    handle: books?.account.handle ?? null,
    equity: summary ? f.money(summary.equityCents) : null,
    buyingPower: summary ? f.money(summary.buyingPowerCents) : null,
    languages: languageOptions(copy),
    digitOptions: digitOptions(copy),
    labels: {
      trigger: m.nav.accountMenu,
      paper: t.paper.tag,
      account: t.paper.account,
      equity: t.common.equity,
      buyingPower: t.portfolio.buyingPower,
      settings: t.settings.title,
      alerts: t.nav.alerts,
      theme: theme === 'dark' ? m.nav.lightTheme : m.nav.darkTheme,
      language: t.settings.language,
      digits: t.settings.digits,
      disclosure: t.paper.disclosure,
      signOut: t.account.rows.signOut,
    },
    actions: {
      toggleTheme: toggle,
      signOut: signOut.signOut,
      setLocale,
      setDigits,
      go: (href: Route) => {
        router.push(href);
      },
    },
  };
}
