import { router } from 'expo-router';
import { useState } from 'react';

import {
  direction,
  marketPill,
  type MoversTab,
  topMovers,
  useAlerts,
  useLiveStatus,
  useLiveSymbols,
  useNotifications,
  useOrders,
  usePortfolio,
  useNow,
  useStockIndex,
  useTradingStatus,
} from '@sarwa/core';

import { type Copy, useCopy } from '../../lib/i18n';
import { describeOrder } from '../orders/order-copy';
import { useEquitySeries } from '../portfolio/use-portfolio-screen';

export type { MoversTab as MoverTab } from '@sarwa/core';

const RECENT = 3;

function greeting({ t }: Copy, hour: number): string {
  if (hour < 12) return t.portfolio.goodMorning;
  return hour < 18 ? t.portfolio.goodAfternoon : t.portfolio.goodEvening;
}

export function useHomeScreen() {
  const copy = useCopy();
  const { t, f } = copy;
  const [moverTab, setMoverTab] = useState<MoversTab>('gainers');
  const portfolio = usePortfolio();
  const curve = useEquitySeries('1D');
  const notifications = useNotifications();
  const openOrders = useOrders({ filter: 'open' });
  const recent = useOrders({ filter: 'all' });
  const alerts = useAlerts();
  const { stocks, sectorOf } = useStockIndex();
  const movers = topMovers(stocks, moverTab);
  useLiveSymbols(movers.map((stock) => stock.symbol));
  const summary = portfolio.summary;
  const now = useNow();

  return {
    greeting: greeting(copy, new Date(now).getHours()),
    market: marketPill(useLiveStatus(), useTradingStatus().data?.session, copy),
    unread: notifications.unreadCount,
    bellLabel: t.notifications.unreadA11y(f.count(notifications.unreadCount)),
    unreadBadge: f.number(notifications.unreadCount),
    isLoading: portfolio.isLoading,
    isError: portfolio.isError,
    equity: summary && {
      value: f.money(summary.equityCents),
      today: {
        label: `${f.money(summary.todayCents, { signed: true })} (${f.percent(summary.todayBps, { signed: true })})`,
        direction: direction(summary.todayCents),
      },
      allTime: {
        label: f.money(summary.allTimeCents, { signed: true }),
        direction: direction(summary.allTimeCents),
      },
      buyingPower: f.money(summary.buyingPowerCents),
      unrealized: {
        label: f.money(summary.unrealizedCents, { signed: true }),
        direction: direction(summary.unrealizedCents),
      },
    },
    curve,
    openOrders: f.number(openOrders.data?.items.length ?? 0),
    activeAlerts: t.portfolio.alertsActive(f.count(alerts.data?.activeCount ?? 0)),
    moverTab,
    movers,
    recent: (recent.data?.items ?? []).slice(0, RECENT).map((order) => ({
      line: describeOrder(order, copy, now),
      sector: sectorOf(order.symbol),
    })),
    actions: {
      setMoverTab,
      retry: () => void portfolio.refresh(),
      openNotifications: () => {
        router.push('/notifications');
      },
      openOrders: () => {
        router.push('/orders');
      },
      openAlerts: () => {
        router.push('/alerts');
      },
      openSearch: () => {
        router.push('/search');
      },
    },
  };
}
