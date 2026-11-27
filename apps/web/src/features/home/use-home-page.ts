import { useState } from 'react';

import {
  direction,
  POLICY,
  useAlerts,
  useEquityCurve,
  useNotifications,
  useOrders,
  usePortfolio,
  useHomeView,
  useResendVerification,
  useSession,
  useTradingStatus,
} from '@sarwa/core';

import { notificationRows } from '../../components/layout/use-notification-center';
import { useCopy } from '../../lib/i18n';
import { resendState } from '../auth/auth-view';

export type { MoversTab } from '@sarwa/core';
export type HeatmapView = 'map' | 'list';

const ACTIVITY = 4;

export function useHomePage() {
  const copy = useCopy();
  const { t, f, m } = copy;
  const portfolio = usePortfolio();
  const equity = useEquityCurve('1D');
  const openOrders = useOrders({ filter: 'open' });
  const alerts = useAlerts();
  const home = useHomeView();
  const { user } = useSession();
  const resend = useResendVerification();
  const notifications = useNotifications();
  const session = useTradingStatus().data?.session;
  const [heatmapView, setHeatmapView] = useState<HeatmapView>('map');
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [now] = useState(() => Date.now());
  const summary = portfolio.summary;
  const tiles = home.heatmap;
  const checklist = home.checklist?.items;

  return {
    mode: home.mode,
    isLoading: portfolio.isLoading,
    // The landing pitch, once the session is known to be a guest; until then the dashboard's
    // skeletons hold the space.
    guest: home.isLoading ? null : home.guest,
    checklist: checklist
      ? {
          emailVerified: checklist.find((item) => item.key === 'verify')?.done ?? true,
          hasTraded: checklist.find((item) => item.key === 'firstTrade')?.done ?? false,
          resend: resendState(resend),
          onResend: () => {
            resend.resend();
          },
        }
      : null,
    banner:
      session?.isOpen && session.earlyClose && !bannerDismissed
        ? {
            title: t.market.closesEarlyTitle,
            body: t.market.closesEarlyBody({ time: f.time(session.closesAt) }),
          }
        : null,
    equity: summary
      ? {
          value: f.money(summary.equityCents),
          today: f.money(summary.todayCents, { signed: true }),
          todayPct: f.percent(summary.todayBps, { signed: true }),
          direction: direction(summary.todayCents),
        }
      : null,
    curve: {
      values: equity.data?.points.map((point) => point.equityCents) ?? [],
      loading: equity.isPending,
    },
    kpis: summary
      ? [
          { label: t.portfolio.buyingPower, value: f.money(summary.buyingPowerCents) },
          {
            label: t.portfolio.unrealized,
            value: f.money(summary.unrealizedCents, { signed: true }),
            direction: direction(summary.unrealizedCents),
          },
          {
            label: t.portfolio.openOrders,
            value: openOrders.data ? f.number(openOrders.data.items.length) : '—',
          },
          {
            label: t.nav.alerts,
            value: alerts.data ? t.portfolio.alertsActive(f.count(alerts.data.activeCount)) : '—',
          },
        ]
      : [],
    heatmap: {
      view: heatmapView,
      tiles,
      rows: tiles.map((tile) => ({ ...tile, direction: direction(tile.change) })),
    },
    movers: { tab: home.movers.tab, rows: home.movers.rows, isLoading: home.movers.isLoading },
    activity: notificationRows(
      notifications.items.slice(0, ACTIVITY),
      now,
      copy,
      user ?? undefined,
    ),
    labels: {
      totalEquity: t.portfolio.totalEquity,
      portfolioLink: m.portfolio.viewAll,
      today: t.portfolio.today,
      heatmap: t.portfolio.sectorHeatmap,
      heatmapHint: t.portfolio.heatmapHint,
      heatmapView: m.home.heatmapView,
      map: m.home.map,
      list: m.home.list,
      movers: t.portfolio.topMovers,
      moverTabs: {
        gainers: t.portfolio.gainers,
        losers: t.portfolio.losers,
        active: t.portfolio.active,
      },
      activity: t.portfolio.recentActivity,
      viewAll: m.home.viewAll,
      noActivity: m.home.noActivity,
      dismiss: t.common.dismiss,
      equityA11y: t.portfolio.equityChart({
        duration: t.common.minutes(f.count(POLICY.snapshotIntervalMs / 60_000)),
      }),
    },
    actions: {
      setMoversTab: home.movers.setTab,
      setHeatmapView,
      dismissBanner: () => {
        setBannerDismissed(true);
      },
    },
  };
}
