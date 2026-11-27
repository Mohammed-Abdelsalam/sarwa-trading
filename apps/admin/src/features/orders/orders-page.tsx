'use client';

import { Pause, Play } from 'lucide-react';

import { type AdminOrder, type Order } from '@sarwa/contracts';
import { bps, cents } from '@sarwa/core';
import { ORDER_STATUSES, useAdminI18n } from '@sarwa/core/admin';
import {
  AllocationBar,
  type AllocationColor,
  Badge,
  Button,
  Card,
  StatTile,
  StatusBadge,
  Table,
  TBody,
  TCell,
  TH,
  THead,
  TRow,
  Select,
} from '@sarwa/ui';

import { BarList, LoadError, PageHeader, TableSkeleton } from '../../components/common/states';
import { type OrdersPageModel, type StatusFilter, useOrdersPage } from './use-orders-page';

const TYPE_COLORS: Record<string, AllocationColor> = {
  market: 'tech',
  limit: 'fin',
  stop: 'energy',
};

function Kpis({ page }: { page: OrdersPageModel }) {
  const { t, f } = useAdminI18n();
  const s = page.stats;
  const tiles = [
    { key: 'ordersToday', value: s && f.number(s.ordersToday) },
    { key: 'fillRate', value: s && f.percent(bps(s.fillRateBps)) },
    { key: 'rejected', value: s && f.percent(bps(s.rejectedBps)) },
    { key: 'notionalTraded', value: s && f.money(cents(s.notionalTodayCents), { compact: true }) },
    { key: 'activeTraders', value: s && f.number(s.activeTraders) },
  ] as const;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {tiles.map((tile) => (
        <StatTile
          key={tile.key}
          label={t.admin.kpis[tile.key]}
          value={tile.value ?? '—'}
          caption={t.admin.orders.today}
        />
      ))}
    </div>
  );
}

// A customer's own orders carry neither the handle nor the latency the live monitor adds.
export type OrderRow = Order & { notionalCents: number } & Partial<
    Pick<AdminOrder, 'accountHandle' | 'latencyMs'>
  >;

export function OrdersTable({
  orders,
  isLoading,
  isError,
  onRetry,
  showAccount = true,
}: {
  orders: readonly OrderRow[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  showAccount?: boolean;
}) {
  const { t, f } = useAdminI18n();
  if (isError) return <LoadError what={t.admin.orders.loading} onRetry={onRetry} />;
  if (isLoading) return <TableSkeleton columns={6} label={t.admin.orders.loading} />;
  if (orders.length === 0) {
    return <p className="type-sm text-fg-2 px-4 py-10 text-center">{t.admin.orders.noOrders}</p>;
  }
  return (
    <Table label={t.admin.ordersMonitor}>
      <THead>
        <TRow>
          <TH className="ps-4">{t.admin.monitorColumns.time}</TH>
          {showAccount ? <TH className="max-md:hidden">{t.admin.monitorColumns.account}</TH> : null}
          <TH>{t.admin.monitorColumns.order}</TH>
          <TH align="end">{t.admin.monitorColumns.notional}</TH>
          <TH>{t.admin.monitorColumns.status}</TH>
          <TH align="end" className="max-md:hidden">
            {t.admin.monitorColumns.latency}
          </TH>
        </TRow>
      </THead>
      <TBody>
        {orders.map((order) => (
          <TRow key={order.id}>
            <TCell className="text-fg-2 ps-4 tabular-nums">
              {f.time(order.createdAt, { seconds: true })}
            </TCell>
            {showAccount ? (
              <TCell className="type-mono max-md:hidden">{order.accountHandle}</TCell>
            ) : null}
            <TCell>
              <span className="flex items-center gap-2">
                <Badge
                  square
                  tone={order.side === 'buy' ? 'brand' : 'outline'}
                  className="h-5 text-[0.625rem]"
                >
                  {t.common.sides[order.side]}
                </Badge>
                <b>{order.symbol}</b>
                <span className="type-sm text-fg-3">
                  {t.ticket.types[order.type]}
                  {order.amountCents !== null ? ` ${t.admin.orders.amountSuffix}` : ''}
                </span>
              </span>
            </TCell>
            <TCell align="end">{f.money(cents(order.notionalCents))}</TCell>
            <TCell>
              <StatusBadge status={order.status} label={t.orderStatus[order.status]} />
            </TCell>
            <TCell align="end" className="text-fg-3 max-md:hidden">
              {order.latencyMs === undefined
                ? '—'
                : t.admin.orders.latency({ n: f.number(order.latencyMs) })}
            </TCell>
          </TRow>
        ))}
      </TBody>
    </Table>
  );
}

export function OrdersPage() {
  const page = useOrdersPage();
  const { t, f } = useAdminI18n();

  return (
    <>
      <PageHeader title={t.admin.ordersMonitor} subtitle={t.admin.ordersMonitorSub}>
        <Select
          aria-label={t.admin.orders.statusFilter}
          className="h-9 w-40"
          value={page.status}
          onChange={(event) => {
            page.actions.setStatus(event.target.value as StatusFilter);
          }}
        >
          <option value="all">{t.admin.allStatuses}</option>
          {ORDER_STATUSES.map((status) => (
            <option key={status} value={status}>
              {t.orderStatus[status]}
            </option>
          ))}
        </Select>
        <Button
          variant="secondary"
          size="sm"
          aria-pressed={page.paused}
          icon={
            page.paused ? (
              <Play aria-hidden className="size-3.5" />
            ) : (
              <Pause aria-hidden className="size-3.5" />
            )
          }
          onClick={page.actions.togglePause}
        >
          {page.paused ? t.admin.orders.resumeStream : t.admin.pauseStream}
        </Button>
        {page.paused && page.missed > 0 ? (
          <Badge tone="info" role="status">
            {t.admin.orders.missed({ n: f.number(page.missed) })}
          </Badge>
        ) : null}
      </PageHeader>
      <Kpis page={page} />
      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <OrdersTable
            orders={page.orders}
            isLoading={page.isLoading}
            isError={page.isError}
            onRetry={page.actions.retry}
          />
        </Card>
        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-2.5 px-4.5 py-4">
            <h2 className="type-h3 text-fg">{t.admin.rejectionsByReason}</h2>
            {page.rejections.length === 0 ? (
              <p className="type-sm text-fg-2">{t.admin.orders.noRejections}</p>
            ) : (
              <BarList
                label={t.admin.rejectionsByReason}
                items={page.rejections.map((row) => ({
                  key: row.code,
                  label: <span className="type-mono text-[0.6875rem]">{row.code}</span>,
                  value: f.percent(row.shareBps),
                  weight: row.weight,
                }))}
              />
            )}
          </Card>
          <Card className="flex flex-col gap-2 px-4.5 py-4">
            <h2 className="type-h3 text-fg">{t.admin.orderMix}</h2>
            <AllocationBar
              label={t.admin.orders.typeMix}
              segments={page.typeMix.map((row) => ({
                key: row.type,
                label: t.ticket.types[row.type],
                value: f.number(row.count),
                weight: row.weight,
                weightLabel: f.percent(row.shareBps),
                colorRole: TYPE_COLORS[row.type] ?? 'cash',
              }))}
            />
            <p className="type-sm text-fg-2 flex justify-between">
              <span>{t.admin.fractional}</span>
              <b className="text-fg tabular-nums">{f.percent(page.fractionalBps)}</b>
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
