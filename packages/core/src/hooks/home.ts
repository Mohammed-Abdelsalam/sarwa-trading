import { useState } from 'react';

import { POLICY } from '@sarwa/domain';

import { heatmapTiles, type MoversTab, topMovers } from '../markets';
import { useI18n } from './i18n';
import { useLiveSymbols } from './live';
import { useStocks } from './market';
import { useOrders } from './orders';
import { useSession } from './session';

export const SIGN_UP_SECONDS = 30;

export type ChecklistKey = 'created' | 'verify' | 'firstTrade';

// The Home tab and web `/` for both a guest (landing) and a member (dashboard parts both share).
export function useHomeView() {
  const { t, f } = useI18n();
  const { status, user } = useSession();
  const stocks = useStocks();
  const orders = useOrders();
  const [moversTab, setMoversTab] = useState<MoversTab>('gainers');
  const list = stocks.data ?? [];
  const movers = topMovers(list, moversTab);
  useLiveSymbols(movers.map((stock) => stock.symbol));

  const mode = status === 'authenticated' ? ('member' as const) : ('guest' as const);
  const amount = f.money(POLICY.startingCashCents, { whole: true });
  const stockCount = f.number(list.length);
  const checklist: { key: ChecklistKey; label: string; done: boolean; action: string | null }[] = [
    { key: 'created', label: t.home.checklist.created, done: true, action: null },
    {
      key: 'verify',
      label: t.home.checklist.verify,
      done: user?.emailVerified ?? true,
      action: t.home.checklist.resend,
    },
    {
      key: 'firstTrade',
      label: t.home.checklist.firstTrade,
      done: (orders.data?.items.length ?? 0) > 0,
      action: t.home.checklist.browse,
    },
  ];

  return {
    mode,
    isLoading: status === 'loading',
    movers: {
      tab: moversTab,
      setTab: setMoversTab,
      rows: movers,
      isLoading: stocks.isPending,
    },
    heatmap: heatmapTiles(list, (bps) => f.percent(bps, { signed: true })),
    guest:
      mode === 'guest'
        ? {
            badge: t.home.guest.badge,
            title: t.home.guest.h1({ amount }),
            body: t.home.guest.body({ n: stockCount }),
            bodyMobile: t.home.guest.bodyMobile({ n: stockCount }),
            howItWorks: t.home.guest.howItWorks,
            steps: [
              { key: 'signUp', label: t.home.guest.stepSignUp({ n: f.number(SIGN_UP_SECONDS) }) },
              { key: 'cash', label: t.home.guest.stepCash({ amount }) },
              { key: 'trade', label: t.home.guest.stepTrade },
            ],
            createAccount: t.gate.cta.createFree,
            signIn: t.gate.cta.signIn,
          }
        : null,
    // A new member's steps, until all are done; hidden until their orders answer, so no flash.
    checklist:
      mode === 'member' && !orders.isPending && checklist.some((item) => !item.done)
        ? { title: t.home.checklist.title, items: checklist }
        : null,
  };
}
