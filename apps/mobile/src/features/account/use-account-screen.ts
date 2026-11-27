import { useState } from 'react';

import { cents, digitOptions, languageOptions, useAccount, usePortfolio } from '@sarwa/core';

import { useCopy } from '../../lib/i18n';

export function useAccountScreen() {
  const copy = useCopy();
  const { t, f, locale, digits, setLocale, setDigits } = copy;
  const account = useAccount();
  const summary = usePortfolio().summary;
  const [explaining, setExplaining] = useState(false);

  return {
    account: account.data
      ? {
          handle: account.data.handle,
          equity: summary ? f.money(summary.equityCents) : '',
          start: f.money(cents(account.data.startingCashCents)),
        }
      : null,
    locale,
    locales: languageOptions(copy),
    digits,
    digitStyles: digitOptions(copy),
    disclosure: t.paper.disclosure,
    explaining,
    actions: {
      setLocale,
      setDigits,
      explain: () => {
        setExplaining(true);
      },
      closeExplain: () => {
        setExplaining(false);
      },
    },
  };
}
