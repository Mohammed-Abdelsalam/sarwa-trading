'use client';

import {
  Copy,
  Download,
  Ellipsis,
  Eye,
  RefreshCw,
  Search,
  TriangleAlert,
  Users,
} from 'lucide-react';
import { type Route } from 'next';
import Link from 'next/link';
import { memo, useEffect, useRef } from 'react';

import { type CustomerKpis, type CustomerRow, type CustomerStatusFilter } from '@sarwa/contracts';
import { bps, cents } from '@sarwa/core';
import { useAdminI18n } from '@sarwa/core/admin';
import {
  Banner,
  Button,
  Card,
  ChangePill,
  Chip,
  type DeltaTone,
  IconButton,
  Input,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SegmentedControl,
  StatTile,
  StateView,
  Table,
  TBody,
  TCell,
  TH,
  THead,
  TRow,
} from '@sarwa/ui';

import { GuardedButton, Locked } from '../../components/common/access';
import { UserAvatar } from '../../components/common/identity';
import { PageHeader, TableSkeleton } from '../../components/common/states';
import { type CustomerActionKind } from '../customer-detail/customer-actions';
import { CustomerStatusBadge, VerifiedBadge } from '../customer-detail/customer-header';
import { useCustomersPage } from './use-customers-page';

export type CustomerSegment = CustomerStatusFilter;
export type LoadState = 'loading' | 'error' | 'ready';

export interface CustomersView {
  // Both stay false until the session is known, so neither role flashes the other's UI.
  isViewer: boolean;
  canEdit: boolean;
  // Shares are basis points of registered customers.
  kpis: (CustomerKpis & { activeShareBps: number; suspendedShareBps: number }) | null;
  rows: readonly CustomerRow[];
  status: LoadState;
  error: { status: number; requestId: string } | null;
  search: string;
  segment: CustomerSegment;
  verified: boolean;
  hasOpenOrders: boolean;
  hasMore: boolean;
  isFetchingMore: boolean;
  isExporting: boolean;
  linkCopied: boolean;
  now: number;
  detailHref: (handle: string) => Route;
  actions: {
    retry: () => void;
    search: (text: string) => void;
    setSegment: (segment: CustomerSegment) => void;
    toggleVerified: () => void;
    toggleOpenOrders: () => void;
    clearFilters: () => void;
    loadMore: () => void;
    exportCsv: () => void;
    copyAppLink: () => void;
    request: (handle: string, kind: CustomerActionKind) => void;
  };
}

const SEGMENTS: readonly CustomerSegment[] = ['all', 'active', 'suspended'];
const HOURS = 24;

function Kpis({ kpis }: { kpis: CustomersView['kpis'] }) {
  const { t, f } = useAdminI18n();
  const copy = t.admin.customers.kpis;
  const pct = (value: number, signed = false) => f.percent(bps(value), { signed });
  const tone = (value: number): DeltaTone => (value > 0 ? 'pos' : value < 0 ? 'neg' : 'flat');
  const points = (value: number) => `${value > 0 ? '+' : ''}${f.number(value / 100)}`;
  const tiles = kpis
    ? [
        {
          label: copy.registered,
          value: f.number(kpis.registered),
          delta: copy.registeredDelta({ pct: pct(kpis.registeredWeekBps, true) }),
          tone: tone(kpis.registeredWeekBps),
        },
        {
          label: copy.signedUpToday,
          value: f.number(kpis.signedUpToday),
          caption: copy.mobileShare({ pct: pct(kpis.signedUpTodayMobileBps) }),
        },
        {
          label: copy.active24h({ n: f.number(HOURS) }),
          value: f.number(kpis.active24h),
          caption: copy.activeShare({ pct: pct(kpis.activeShareBps) }),
        },
        {
          label: copy.suspended,
          value: f.number(kpis.suspended),
          caption: copy.suspendedDelta({
            pct: pct(kpis.suspendedShareBps),
            n: f.number(kpis.suspendedToday),
          }),
        },
        {
          label: copy.verified,
          value: pct(kpis.verifiedBps),
          delta: copy.verifiedDelta({ pt: points(kpis.verifiedDeltaBps) }),
          tone: tone(kpis.verifiedDeltaBps),
        },
        {
          label: copy.guests24h({ n: f.number(HOURS) }),
          value: f.number(kpis.guests24h),
          caption: copy.conversion({ pct: pct(kpis.conversionBps) }),
        },
      ]
    : null;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {tiles
        ? tiles.map((tile) => (
            <StatTile
              key={tile.label}
              label={tile.label}
              value={tile.value}
              delta={tile.delta}
              deltaTone={tile.tone}
              caption={tile.caption}
            />
          ))
        : Array.from({ length: 6 }, (_, i) => <StatTile key={i} label="" value="—" />)}
    </div>
  );
}

function ViewerBanner() {
  const { t } = useAdminI18n();
  const copy = t.admin.customers;
  return (
    <Banner tone="info" icon={<Eye />}>
      <span>
        {copy.viewerBanner} {copy.viewerMasked}{' '}
        <Popover>
          <PopoverTrigger className="text-brand-fg cursor-pointer font-semibold underline">
            {copy.viewerWhy}
          </PopoverTrigger>
          <PopoverContent className="type-sm max-w-80">{copy.viewerWhyBody}</PopoverContent>
        </Popover>
      </span>
    </Banner>
  );
}

const narrow = 'max-md:hidden';
const wide = 'max-lg:hidden';

const Row = memo(function Row({
  row,
  view,
}: {
  row: CustomerRow;
  view: Pick<CustomersView, 'isViewer' | 'now' | 'detailHref' | 'actions'>;
}) {
  const { t, f } = useAdminI18n();
  const copy = t.admin.customers;
  const actions = t.admin.customer.actions;
  const items: { kind: CustomerActionKind; label: string; danger?: boolean }[] = [
    row.status === 'suspended'
      ? { kind: 'reactivate', label: actions.reactivate }
      : { kind: 'suspend', label: actions.suspend, danger: true },
    { kind: 'signOutAll', label: actions.signOutAll },
    { kind: 'sendReset', label: actions.sendReset },
    { kind: 'resetAccount', label: actions.resetAccount, danger: true },
  ];
  return (
    // 56 px rows: the list is cursor-paged and kept virtualization-ready.
    <TRow className="[&>td]:h-14">
      <TCell className="ps-4">
        <span className="flex items-center gap-3">
          <UserAvatar name={row.name} />
          <span className="min-w-0">
            <Link
              href={view.detailHref(row.handle)}
              className="text-fg block truncate font-semibold hover:underline"
            >
              {row.name}
            </Link>
            <span className="type-caption text-fg-3 block truncate">{row.email}</span>
          </span>
        </span>
      </TCell>
      <TCell className={`type-mono text-fg-2 ${narrow}`}>{row.handle}</TCell>
      <TCell>
        <CustomerStatusBadge customer={row} />
      </TCell>
      <TCell className={wide}>
        <VerifiedBadge verified={row.emailVerified} />
      </TCell>
      <TCell align="end" className="font-semibold">
        {f.money(cents(row.equityCents))}
      </TCell>
      <TCell align="end" className={narrow}>
        <span className="inline-flex">
          <ChangePill
            size="sm"
            value={row.allTimeBps}
            label={f.money(cents(row.allTimeCents), { signed: true })}
          />
        </span>
      </TCell>
      <TCell align="end" className={narrow}>
        {f.number(row.openOrders)}
      </TCell>
      <TCell className={`text-fg-2 ${wide}`}>
        {row.lastActiveAt === null ? t.admin.states.never : f.relative(row.lastActiveAt, view.now)}
      </TCell>
      <TCell className={`text-fg-2 ${wide}`}>{f.date(row.createdAt)}</TCell>
      <TCell align="end" className="pe-4">
        <Menu>
          <Locked locked={view.isViewer}>
            <MenuTrigger asChild>
              <IconButton size={32} label={copy.rowActions({ name: row.name })}>
                <Ellipsis aria-hidden className="size-4" />
              </IconButton>
            </MenuTrigger>
          </Locked>
          <MenuContent>
            {items.map((item) => (
              <MenuItem
                key={item.kind}
                danger={item.danger}
                onSelect={() => {
                  view.actions.request(row.handle, item.kind);
                }}
              >
                {item.label}
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>
      </TCell>
    </TRow>
  );
});

// Asks for the next cursor page as the end of the list scrolls into view.
function LoadMore({ view }: { view: CustomersView }) {
  const { t } = useAdminI18n();
  const ref = useRef<HTMLDivElement>(null);
  const { hasMore, isFetchingMore, actions } = view;
  useEffect(() => {
    const node = ref.current;
    if (!node || !hasMore || isFetchingMore || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) actions.loadMore();
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [hasMore, isFetchingMore, actions]);
  return (
    <div ref={ref} role="status" className="type-sm text-fg-3 px-4 py-3 text-center empty:hidden">
      {isFetchingMore ? t.admin.customers.loadMore : null}
    </div>
  );
}

function activeFilters(view: CustomersView, t: ReturnType<typeof useAdminI18n>['t']): string[] {
  const copy = t.admin.customers;
  return [
    view.segment === 'all' ? null : copy.statuses[view.segment],
    view.verified ? copy.filters.verified : null,
    view.hasOpenOrders ? copy.filters.hasOpenOrders : null,
  ].filter((label): label is string => label !== null);
}

function CustomersTable({ view }: { view: CustomersView }) {
  const { t } = useAdminI18n();
  const copy = t.admin.customers;
  const filters = activeFilters(view, t);
  const query = view.search.trim();

  if (view.status === 'error') {
    return (
      <StateView
        tone="neg"
        icon={<TriangleAlert />}
        title={copy.error.title}
        description={copy.error.body}
        footnote={
          view.error
            ? copy.error.meta({
                status: String(view.error.status),
                requestId: view.error.requestId,
              })
            : undefined
        }
        action={
          <Button icon={<RefreshCw aria-hidden className="size-4" />} onClick={view.actions.retry}>
            {t.admin.states.retry}
          </Button>
        }
      />
    );
  }
  if (view.status === 'loading') {
    return <TableSkeleton rows={8} columns={9} label={copy.loading} />;
  }
  if (view.rows.length === 0 && (query || filters.length > 0)) {
    return (
      <StateView
        icon={<Search />}
        title={query ? copy.empty.title({ q: query }) : copy.empty.titleFilters}
        description={copy.empty.body({
          filters: filters.length > 0 ? filters.join(' · ') : copy.empty.noFilters,
        })}
        action={
          <Button variant="secondary" onClick={view.actions.clearFilters}>
            {copy.empty.clear}
          </Button>
        }
      />
    );
  }
  if (view.rows.length === 0) {
    return (
      <StateView
        tone="brand"
        icon={<Users />}
        title={copy.zero.title}
        description={copy.zero.body}
        action={
          <Button icon={<Copy aria-hidden className="size-4" />} onClick={view.actions.copyAppLink}>
            {view.linkCopied ? copy.zero.copied : copy.zero.copyLink}
          </Button>
        }
      />
    );
  }
  return (
    <>
      <Table label={copy.title}>
        <THead>
          <TRow>
            <TH className="ps-4">{copy.columns.customer}</TH>
            <TH className={narrow}>{copy.columns.handle}</TH>
            <TH>{copy.columns.status}</TH>
            <TH className={wide}>{copy.columns.verified}</TH>
            <TH align="end">{copy.columns.equity}</TH>
            <TH align="end" className={narrow}>
              {copy.columns.allTime}
            </TH>
            <TH align="end" className={narrow}>
              {copy.columns.openOrders}
            </TH>
            <TH className={wide}>{copy.columns.lastActive}</TH>
            <TH className={wide}>{copy.columns.joined}</TH>
            <TH align="end" className="pe-4">
              <span className="sr-only">{copy.columns.actions}</span>
            </TH>
          </TRow>
        </THead>
        <TBody>
          {view.rows.map((row) => (
            <Row key={row.id} row={row} view={view} />
          ))}
        </TBody>
      </Table>
      <LoadMore view={view} />
    </>
  );
}

export function CustomersPage({ view }: { view: CustomersView }) {
  const { t, f } = useAdminI18n();
  const copy = t.admin.customers;
  const suspended = view.kpis ? f.number(view.kpis.suspended) : '—';

  return (
    <>
      {view.isViewer ? <ViewerBanner /> : null}
      <PageHeader
        title={copy.title}
        subtitle={view.kpis ? copy.subtitle({ n: f.number(view.kpis.registered) }) : undefined}
      >
        <GuardedButton
          variant="secondary"
          locked={view.isViewer}
          reason={copy.exportLocked}
          disabled={!view.canEdit}
          loading={view.isExporting}
          icon={<Download aria-hidden className="size-4" />}
          onClick={view.actions.exportCsv}
        >
          {copy.export}
        </GuardedButton>
      </PageHeader>
      <Kpis kpis={view.kpis} />
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-80 max-sm:w-full">
          <Input
            type="search"
            icon={<Search />}
            className="w-full"
            aria-label={copy.searchLabel}
            placeholder={copy.searchPlaceholder}
            value={view.search}
            onChange={(event) => {
              view.actions.search(event.target.value);
            }}
          />
        </div>
        <SegmentedControl
          label={copy.columns.status}
          options={SEGMENTS.map((value) => ({
            value,
            label:
              value === 'suspended'
                ? copy.segments.suspended({ n: suspended })
                : copy.segments[value],
          }))}
          value={view.segment}
          onChange={view.actions.setSegment}
        />
        <Chip
          active={view.verified}
          aria-pressed={view.verified}
          onClick={view.actions.toggleVerified}
        >
          {copy.filters.verified}
        </Chip>
        <Chip
          active={view.hasOpenOrders}
          aria-pressed={view.hasOpenOrders}
          onClick={view.actions.toggleOpenOrders}
        >
          {copy.filters.hasOpenOrders}
        </Chip>
      </div>
      <Card className="overflow-hidden">
        <CustomersTable view={view} />
      </Card>
    </>
  );
}

export function CustomersScreen() {
  return <CustomersPage view={useCustomersPage()} />;
}
