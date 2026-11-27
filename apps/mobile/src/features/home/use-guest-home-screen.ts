import { useHomeView, useStocks } from '@sarwa/core';

import { useCopy } from '../../lib/i18n';
import { useGuestCta } from '../gating/use-guest-cta';
import { type GuestHomeView } from './guest-home';

export function useGuestHomeScreen(): GuestHomeView {
  const { f } = useCopy();
  const { movers } = useHomeView();
  const { startingCash, onCreateAccount, onSignIn } = useGuestCta();
  return {
    startingCash,
    stockCount: f.number(useStocks().data?.length ?? 0),
    moverTab: movers.tab,
    movers: movers.rows,
    onMoverTab: movers.setTab,
    onCreateAccount,
    onSignIn,
  };
}
