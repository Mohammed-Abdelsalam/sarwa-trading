'use client';

import { Eye, EyeOff, Info, Monitor, SearchX, Smartphone } from 'lucide-react';
import { type KeyboardEvent, type ReactNode } from 'react';

import {
  type CustomerActivityAction,
  type CustomerDetail,
  type CustomerSession,
  type Sector,
} from '@sarwa/contracts';
import { bps, cents, micros } from '@sarwa/core';
import { useAdminI18n } from '@sarwa/core/admin';
import {
  Breadcrumbs,
  Button,
  Callout,
  Card,
  ChangePill,
  cn,
  type DeltaTone,
  StatTile,
  StateView,
  StockAvatar,
  Table,
  TBody,
  TCell,
  TH,
  THead,
  TRow,
} from '@sarwa/ui';

import { GuardedButton, ViewerNotice } from '../../components/common/access';
import { ActionBadge } from '../../components/common/action-badge';
import { LoadError, TableSkeleton } from '../../components/common/states';
import { type OrderRow, OrdersTable } from '../orders/orders-page';
import { ActionsPanel, CustomerActionDialog, type CustomerActionView } from './customer-actions';
import { CustomerHeader } from './customer-header';
import { useCustomerDetailPage } from './use-customer-detail-page';

export type CustomerTab = 'overview' | 'orders' | 'sessions' | 'activity';
type LoadState = 'loading' | 'error' | 'ready';

export interface CustomerPositionView {
  symbol: string;
  sector: Sector;
  qtyMicros: number;
  avgCostCents: number;
  marketValueCents: number;
  returnCents: number;
  returnBps: number;
}

export interface CustomerActivityRow {
  id: string;
  at: number;
  actor: { kind: 'customer' | 'admin' | 'system'; email: string | null };
  action: CustomerActivityAction;
  preview: string;
}

export interface CustomerDetailView {
  status: LoadState | 'notFound';
  detail: CustomerDetail | null;
  error: unknown;
  positions: readonly CustomerPositionView[];
  // Set while a deletion request waits for the 7-day purge.
  purgesAt: number | null;
  isViewer: boolean;
  canEdit: boolean;
  tab: CustomerTab;
  now: number;
  listHref: string;
  orders: { items: readonly OrderRow[]; status: LoadState };
  sessions: {
    items: readonly CustomerSession[];
    status: LoadState;
    // Full IPs by session id, once an ADMIN revealed them (audited as customer.pii_viewed).
    fullIps: Readonly<Record<string, string | null>> | null;
    isRevealing: boolean;
  };
  activity: {
    items: readonly CustomerActivityRow[];
    status: LoadState;
    hasMore: boolean;
    isFetchingMore: boolean;
  };
  action: CustomerActionView;
  actions: {
    retry: () => void;
    setTab: (tab: CustomerTab) => void;
    retryOrders: () => void;
    retrySessions: () => void;
    revealIps: () => void;
    hideIps: () => void;
    retryActivity: () => void;
    loadMoreActivity: () => void;
  };
}

const TABS: readonly CustomerTab[] = ['overview', 'orders', 'sessions', 'activity'];

function Tabs({ view, detail }: { view: CustomerDetailView; detail: CustomerDetail }) {
  const { t, f } = useAdminI18n();
  const copy = t.admin.customer.tabs;
  const labels: Record<CustomerTab, string> = {
    overview: copy.overview,
    orders: copy.orders({ n: f.number(detail.customer.openOrders) }),
    sessions: copy.sessions({ n: f.number(detail.activeSessions) }),
    activity: copy.activity,
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const forward = event.currentTarget.closest('[dir]')?.getAttribute('dir') === 'rtl' ? -1 : 1;
    const step = { ArrowRight: forward, ArrowLeft: -forward }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = TABS[(TABS.indexOf(view.tab) + step + TABS.length) % TABS.length] ?? 'overview';
    view.actions.setTab(next);
    event.currentTarget.parentElement
      ?.querySelector<HTMLButtonElement>(`#customer-tab-${next}`)
      ?.focus();
  };
  return (
    <div
      role="tablist"
      aria-label={t.admin.customer.tabsLabel}
      className="border-border flex gap-1 overflow-x-auto border-b"
    >
      {TABS.map((tab) => {
        const selected = tab === view.tab;
        return (
          <button
            key={tab}
            id={`customer-tab-${tab}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls="customer-panel"
            tabIndex={selected ? 0 : -1}
            onKeyDown={onKeyDown}
            onClick={() => {
              view.actions.setTab(tab);
            }}
            className={cn(
              'type-sm focus-visible:outline-focus -mb-px h-10 shrink-0 cursor-pointer border-b-2 px-3 font-semibold whitespace-nowrap focus-visible:outline-2',
              selected ? 'border-brand text-fg' : 'text-fg-2 hover:text-fg border-transparent',
            )}
          >
            {labels[tab]}
          </button>
        );
      })}
    </div>
  );
}

function OverviewTab({ view, detail }: { view: CustomerDetailView; detail: CustomerDetail }) {
  const { t, f } = useAdminI18n();
  const copy = t.admin.customer;
  const { portfolio } = detail;
  const money = (value: number, signed = false) => f.money(cents(value), { signed });
  const tone = (value: number): DeltaTone => (value > 0 ? 'pos' : value < 0 ? 'neg' : 'flat');
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          label={copy.kpis.equity}
          value={money(portfolio.equityCents)}
          delta={copy.kpis.dayPl({ amount: money(portfolio.dayCents, true) })}
          deltaTone={tone(portfolio.dayCents)}
        />
        <StatTile
          label={copy.kpis.cash}
          value={money(portfolio.cashCents)}
          caption={copy.kpis.reserved({ amount: money(portfolio.reservedCents) })}
        />
        <StatTile
          label={copy.kpis.allTime}
          value={money(portfolio.allTimeCents, true)}
          delta={f.percent(bps(portfolio.allTimeBps), { signed: true })}
          deltaTone={tone(portfolio.allTimeCents)}
        />
        <StatTile
          label={copy.kpis.positions}
          value={f.number(portfolio.positions.length)}
          caption={copy.kpis.openOrders({ n: f.number(detail.customer.openOrders) })}
        />
      </div>
      <Card className="overflow-hidden">
        <h2 className="type-h3 text-fg px-4 pt-4 pb-2">{copy.positions.title}</h2>
        {view.positions.length === 0 ? (
          <p className="type-sm text-fg-2 px-4 pb-6">{copy.positions.empty}</p>
        ) : (
          <Table label={copy.positions.title}>
            <THead>
              <TRow>
                <TH className="ps-4">{copy.positions.columns.position}</TH>
                <TH align="end">{copy.positions.columns.shares}</TH>
                <TH align="end" className="max-md:hidden">
                  {copy.positions.columns.avgCost}
                </TH>
                <TH align="end">{copy.positions.columns.marketValue}</TH>
                <TH align="end" className="pe-4">
                  {copy.positions.columns.totalReturn}
                </TH>
              </TRow>
            </THead>
            <TBody>
              {view.positions.map((position) => (
                <TRow key={position.symbol}>
                  <TCell className="ps-4">
                    <span className="flex items-center gap-2.5">
                      <StockAvatar symbol={position.symbol} sector={position.sector} size={32} />
                      <b>{position.symbol}</b>
                    </span>
                  </TCell>
                  <TCell align="end">{f.shares(micros(position.qtyMicros))}</TCell>
                  <TCell align="end" className="max-md:hidden">
                    {money(position.avgCostCents)}
                  </TCell>
                  <TCell align="end" className="font-semibold">
                    {money(position.marketValueCents)}
                  </TCell>
                  <TCell align="end" className="pe-4">
                    <span className="inline-flex">
                      <ChangePill
                        size="sm"
                        value={position.returnBps}
                        label={money(position.returnCents, true)}
                      />
                    </span>
                  </TCell>
                </TRow>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function SessionsTab({ view }: { view: CustomerDetailView }) {
  const { t, f } = useAdminI18n();
  const copy = t.admin.customer.sessions;
  const { sessions } = view;
  const revealed = sessions.fullIps !== null;
  let body: ReactNode;
  if (sessions.status === 'error') {
    body = <LoadError what={t.admin.customer.loading} onRetry={view.actions.retrySessions} />;
  } else if (sessions.status === 'loading') {
    body = <TableSkeleton rows={3} columns={3} label={t.admin.customer.loading} />;
  } else if (sessions.items.length === 0) {
    body = <p className="type-sm text-fg-2 px-4 py-8 text-center">{copy.empty}</p>;
  } else {
    body = (
      <ul>
        {sessions.items.map((session) => (
          <li
            key={session.id}
            className="border-border flex items-center gap-3 border-b px-4 py-3 last:border-b-0"
          >
            <span
              aria-hidden
              className="bg-surface-3 text-fg-2 grid size-9 shrink-0 place-items-center rounded-md [&>svg]:size-4"
            >
              {session.platform === 'web' ? <Monitor /> : <Smartphone />}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <b className="type-sm text-fg truncate">{session.label}</b>
              <span className="type-caption text-fg-3 tabular-nums">
                {copy.meta({
                  ip: sessions.fullIps?.[session.id] ?? session.ipMasked,
                  time: f.relative(session.lastActiveAt, view.now),
                })}
              </span>
            </span>
            <span className="type-caption text-fg-3 shrink-0 max-sm:hidden">
              {copy.since({ date: f.date(session.createdAt) })}
            </span>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="type-caption text-fg-3">{copy.revealNote}</span>
        <GuardedButton
          variant="secondary"
          size="sm"
          locked={view.isViewer}
          disabled={!view.canEdit || sessions.items.length === 0}
          loading={sessions.isRevealing}
          icon={
            revealed ? (
              <EyeOff aria-hidden className="size-3.5" />
            ) : (
              <Eye aria-hidden className="size-3.5" />
            )
          }
          onClick={revealed ? view.actions.hideIps : view.actions.revealIps}
        >
          {revealed ? copy.hideIps : copy.showIps}
        </GuardedButton>
      </div>
      <Card className="overflow-hidden">{body}</Card>
      <Callout tone="info" icon={<Info />}>
        {copy.note}
      </Callout>
    </div>
  );
}

function ActivityTab({ view }: { view: CustomerDetailView }) {
  const { t, f } = useAdminI18n();
  const copy = t.admin.customer.activity;
  const { activity } = view;
  if (activity.status === 'error') {
    return <LoadError what={t.admin.customer.loading} onRetry={view.actions.retryActivity} />;
  }
  if (activity.status === 'loading') {
    return <TableSkeleton rows={5} columns={4} label={t.admin.customer.loading} />;
  }
  if (activity.items.length === 0) {
    return <p className="type-sm text-fg-2 px-4 py-8 text-center">{copy.empty}</p>;
  }
  const actor = (row: CustomerActivityRow) =>
    row.actor.kind === 'customer'
      ? copy.actorCustomer
      : row.actor.kind === 'system'
        ? copy.actorSystem
        : copy.actorAdmin({ email: row.actor.email ?? '' });
  return (
    <Card className="overflow-hidden">
      <Table label={copy.columns.action}>
        <THead>
          <TRow>
            <TH className="ps-4">{copy.columns.time}</TH>
            <TH>{copy.columns.actor}</TH>
            <TH>{copy.columns.action}</TH>
            <TH className="pe-4 max-md:hidden">{copy.columns.detail}</TH>
          </TRow>
        </THead>
        <TBody>
          {activity.items.map((row) => (
            <TRow key={row.id}>
              <TCell className="text-fg-2 ps-4 tabular-nums">{f.dateTime(row.at)}</TCell>
              <TCell className="text-fg-2">{actor(row)}</TCell>
              <TCell>
                <ActionBadge action={row.action} />
              </TCell>
              <TCell className="type-mono text-fg-2 max-w-90 truncate pe-4 max-md:hidden">
                {row.preview}
              </TCell>
            </TRow>
          ))}
        </TBody>
      </Table>
      {activity.hasMore ? (
        <div className="border-border flex justify-center border-t p-3">
          <Button
            variant="ghost"
            size="sm"
            loading={activity.isFetchingMore}
            onClick={view.actions.loadMoreActivity}
          >
            {copy.loadMore}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

export function CustomerDetailPage({ view }: { view: CustomerDetailView }) {
  const { t } = useAdminI18n();
  const copy = t.admin.customer;
  const detail = view.detail;
  const crumbs = [{ label: copy.breadcrumb, href: view.listHref }];

  if (view.status === 'error') {
    return <LoadError what={copy.loading} onRetry={view.actions.retry} error={view.error} />;
  }
  if (view.status === 'notFound') {
    return (
      <>
        <Breadcrumbs items={crumbs} />
        <StateView icon={<SearchX />} title={copy.notFound} />
      </>
    );
  }
  if (view.status === 'loading' || !detail) {
    return <TableSkeleton rows={4} columns={4} label={copy.loading} />;
  }

  const panels: Record<CustomerTab, ReactNode> = {
    overview: <OverviewTab view={view} detail={detail} />,
    orders: (
      <Card className="overflow-hidden">
        <OrdersTable
          orders={view.orders.items}
          isLoading={view.orders.status === 'loading'}
          isError={view.orders.status === 'error'}
          onRetry={view.actions.retryOrders}
          showAccount={false}
        />
      </Card>
    ),
    sessions: <SessionsTab view={view} />,
    activity: <ActivityTab view={view} />,
  };

  return (
    <>
      {view.isViewer ? <ViewerNotice message={copy.viewerBanner} /> : null}
      <Breadcrumbs items={[...crumbs, { label: detail.customer.name }]} />
      <CustomerHeader detail={detail} purgesAt={view.purgesAt} now={view.now} />
      <SuspensionNote detail={detail} />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <Tabs view={view} detail={detail} />
          <div
            id="customer-panel"
            role="tabpanel"
            aria-labelledby={`customer-tab-${view.tab}`}
            tabIndex={0}
            className="focus-visible:outline-focus focus-visible:outline-2"
          >
            {panels[view.tab]}
          </div>
        </div>
        <aside>
          <ActionsPanel detail={detail} action={view.action} access={view} />
        </aside>
      </div>
      <CustomerActionDialog detail={detail} action={view.action} />
    </>
  );
}

function SuspensionNote({ detail }: { detail: CustomerDetail }) {
  const { t, f } = useAdminI18n();
  const suspension = detail.suspension;
  if (!suspension) return null;
  return (
    <Callout tone="neg" title={t.admin.customer.suspension.title}>
      <span className="text-fg-2 flex flex-col gap-0.5">
        <span>
          <b>{t.admin.customers.reasonCategories[suspension.reasonCategory]}</b> ·{' '}
          {suspension.reason}
        </span>
        <span className="type-caption">
          {t.admin.customer.suspension.by({
            who: suspension.by ?? t.admin.customer.activity.actorSystem,
            date: f.dateTime(suspension.at),
          })}
        </span>
      </span>
    </Callout>
  );
}

export function CustomerDetailScreen({ handle }: { handle: string }) {
  return <CustomerDetailPage view={useCustomerDetailPage(handle)} />;
}
