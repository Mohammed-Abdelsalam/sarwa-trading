'use client';

import {
  Activity,
  Database,
  Eye,
  FileText,
  RefreshCw,
  SlidersHorizontal,
  Star,
  UserCheck,
  Users,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { type ReactNode } from 'react';

import { type AuditAction } from '@sarwa/contracts';
import { bps } from '@sarwa/core';
import { useAdminI18n } from '@sarwa/core/admin';
import { Badge, Button, Card, ConnectionBadge, Skeleton, Spinner, StockAvatar } from '@sarwa/ui';

import { BarList, LoadError, PageHeader } from '../../components/common/states';
import { TickerRows } from '../../components/common/ticker';
import { type OverviewPageModel, useOverviewPage } from './use-overview-page';

function KpiCard({
  label,
  value,
  note,
  icon,
}: {
  label: string;
  value: ReactNode;
  note: string;
  icon: ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-2.5 p-5">
      <div className="flex items-center justify-between">
        <span className="type-sm text-fg-2 font-semibold">{label}</span>
        <span
          aria-hidden
          className="bg-brand-subtle text-brand-fg grid size-8 place-items-center rounded-[10px] [&>svg]:size-4"
        >
          {icon}
        </span>
      </div>
      <span className="text-fg text-[2rem] leading-[2.375rem] font-bold tracking-[-0.01em] tabular-nums">
        {value}
      </span>
      <span className="type-caption text-fg-3">{note}</span>
    </Card>
  );
}

const ACTIVITY_ICONS: Partial<Record<AuditAction, ReactNode>> = {
  'market.pause': <Activity />,
  'market.resume': <Activity />,
  'market.volatility': <Activity />,
  'stock.create': <Database />,
  'stock.update': <Database />,
  'stock.delete': <Database />,
  'config.update': <SlidersHorizontal />,
  'trading.update': <Zap />,
};

function MarketCard({ page }: { page: OverviewPageModel }) {
  const { t, f } = useAdminI18n();
  const market = page.stats?.market;
  if (!market) return null;
  const running = market.state === 'running';
  const tiles = [
    { label: t.admin.overview.volatility, value: f.multiplier(market.volatility) },
    { label: t.admin.overview.ticksPerSecond, value: f.number(Math.round(market.ticksPerSecond)) },
    {
      label: t.admin.overview.symbols,
      value: `${f.number(market.enabledSymbols)} / ${f.number(market.totalSymbols)}`,
    },
  ];
  return (
    <Card className="flex flex-col gap-3.5 px-6 pt-5">
      <div className="flex items-center justify-between">
        <h2 className="type-h3 text-fg">{t.admin.overview.liveMarket}</h2>
        <Link href="/market" className="type-sm text-brand-fg font-semibold hover:underline">
          {t.admin.overview.controlRoom}
        </Link>
      </div>
      <div className="flex items-center gap-3">
        <ConnectionBadge
          status={running ? 'live' : 'paused'}
          label={running ? t.admin.market.running : t.admin.market.paused}
          className="text-sm"
        />
        <span className="type-sm text-fg-2 tabular-nums">
          {t.admin.overview.since({ time: f.time(market.since) })}
        </span>
      </div>
      <dl className="grid grid-cols-3 gap-2">
        {tiles.map((tile) => (
          <div key={tile.label} className="bg-surface-3 rounded-[10px] px-3 py-2.5">
            <dt className="type-overline text-fg-3">{tile.label}</dt>
            <dd className="type-num-md text-fg">{tile.value}</dd>
          </div>
        ))}
      </dl>
      <TickerRows
        rows={page.ticker}
        isLoading={page.tickerLoading}
        frozen={!running}
        className="border-border -mx-6 border-t px-2"
      />
    </Card>
  );
}

export function OverviewPage() {
  const page = useOverviewPage();
  const { t, f } = useAdminI18n();
  const copy = t.admin.overview;

  const header = (
    <PageHeader title={copy.title} subtitle={copy.subtitle}>
      {page.updatedAt ? (
        <Badge tone="outline" role="status" className="h-7.5 px-3">
          {page.isRefreshing ? <Spinner className="text-brand-fg size-3" /> : null}
          {copy.autoRefresh({ time: f.time(page.updatedAt, { seconds: true }) })}
        </Badge>
      ) : null}
      <Button
        variant="secondary"
        size="sm"
        icon={<RefreshCw aria-hidden className="size-3.5" />}
        onClick={page.actions.refresh}
      >
        {copy.refresh}
      </Button>
    </PageHeader>
  );

  if (page.isError && !page.stats) {
    return (
      <>
        {header}
        <LoadError what={copy.stats} onRetry={page.actions.refresh} />
      </>
    );
  }

  const stats = page.stats;
  // Optional customer counts: a server without accounts yet leaves them out.
  const count = (value: number | undefined) => (stats ? f.number(value ?? 0) : undefined);
  const kpis = [
    {
      key: 'connectedClients',
      icon: <Users />,
      label: copy.kpis.connectedClients,
      note: copy.kpiNotes.connectedClients,
      value: count(stats?.connectedClients),
    },
    {
      key: 'activeSubscriptions',
      icon: <Zap />,
      label: copy.kpis.activeSubscriptions,
      note: copy.kpiNotes.activeSubscriptions,
      value: count(stats?.activeSubscriptions),
    },
    {
      key: 'registeredCustomers',
      icon: <UserCheck />,
      label: copy.registeredCustomers,
      note: copy.signedUpToday({ n: f.number(stats?.signedUpToday ?? 0) }),
      value: count(stats?.registeredCustomers),
    },
    {
      key: 'guestVisitors',
      icon: <Eye />,
      label: copy.guestVisitors({ n: f.number(24) }),
      note: copy.guestConversion({ pct: f.percent(bps(stats?.guestConversionBps ?? 0)) }),
      value: count(stats?.guestVisitors24h),
    },
    {
      key: 'watchlistItems',
      icon: <Star />,
      label: copy.kpis.watchlistItems,
      note: copy.kpiNotes.watchlistItems,
      value: count(stats?.watchlistItems),
    },
  ];

  return (
    <>
      {header}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {kpis.map((kpi) => (
          <KpiCard
            key={kpi.key}
            label={kpi.label}
            note={kpi.note}
            icon={kpi.icon}
            value={kpi.value ?? <Skeleton className="h-8 w-24" />}
          />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Card className="flex flex-col gap-4 px-6 py-5" aria-labelledby="top-watchlisted">
          <div>
            <h2 id="top-watchlisted" className="type-h3 text-fg">
              {copy.topWatchlisted}
            </h2>
            <span className="type-caption text-fg-3">{copy.topWatchlistedSub}</span>
          </div>
          {page.isLoading ? (
            <div className="flex flex-col gap-2.5" aria-hidden>
              {[0, 1, 2, 3, 4].map((row) => (
                <Skeleton key={row} className="h-6 w-full" />
              ))}
            </div>
          ) : page.bars.length === 0 ? (
            <p className="type-sm text-fg-2">{copy.noWatchlists}</p>
          ) : (
            <BarList
              label={copy.topWatchlisted}
              items={page.bars.map((bar) => ({
                key: bar.symbol,
                weight: bar.weight,
                value: f.number(bar.count),
                label: (
                  <span className="flex items-center gap-2.5">
                    <StockAvatar symbol={bar.symbol} sector={bar.sector} size={32} />
                    <b className="type-sm text-fg">{bar.symbol}</b>
                  </span>
                ),
              }))}
            />
          )}
        </Card>
        <div className="flex min-h-0 flex-col gap-4">
          <MarketCard page={page} />
          <Card className="flex flex-1 flex-col gap-3 px-6 py-4.5">
            <h2 className="type-h3 text-fg">{copy.recentActivity}</h2>
            {page.activity.length === 0 && !page.isLoading ? (
              <p className="type-sm text-fg-2">{copy.noActivity}</p>
            ) : null}
            <ul className="flex flex-col gap-3">
              {page.activity.map((entry) => (
                <li key={entry.id} className="flex items-start gap-3">
                  <span aria-hidden className="text-brand-fg mt-0.5 [&>svg]:size-4">
                    {ACTIVITY_ICONS[entry.action] ?? <FileText />}
                  </span>
                  <div className="flex-1">
                    <p className="type-sm text-fg">
                      <b>{entry.actor}</b> {t.admin.activity[entry.action]} · {entry.entity}
                    </p>
                    <p className="type-caption text-fg-3">{f.relative(entry.at, page.updatedAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
