'use client';

import { RotateCcw, Search, ShieldCheck } from 'lucide-react';

import { bps, cents, useI18n } from '@sarwa/core';
import {
  Button,
  Callout,
  Card,
  ChangePill,
  cn,
  Drawer,
  EstimateRows,
  Input,
  SortHeader,
  StateView,
  Table,
  TBody,
  TCell,
  TH,
  THead,
  TRow,
} from '@sarwa/ui';

import { GuardedButton } from '../../components/common/access';
import { LoadError, PageHeader, Pagination, TableSkeleton } from '../../components/common/states';
import { ResetDialog } from './reset-dialog';
import {
  ACCOUNTS_PAGE_SIZE,
  type AccountSort,
  type AccountsPageModel,
  useAccountsPage,
} from './use-accounts-page';

const tone = (cents: number) => (cents > 0 ? 'text-pos' : cents < 0 ? 'text-neg' : 'text-fg-2');

function AccountsTable({ page }: { page: AccountsPageModel }) {
  const { t, f } = useI18n();
  const columns = t.admin.accountColumns;
  const sortHeader = (key: AccountSort, label: string, align: 'start' | 'end' = 'end') => (
    <SortHeader
      label={label}
      align={align}
      direction={page.sort === key ? 'descending' : 'none'}
      onSort={() => {
        page.actions.sortBy(key);
      }}
    />
  );

  if (page.isError)
    return <LoadError what={t.admin.accountList.loading} onRetry={page.actions.retry} />;
  if (page.isLoading) return <TableSkeleton columns={9} label={t.admin.accountList.loading} />;
  if (page.rows.length === 0) {
    return (
      <StateView
        icon={<Search />}
        title={
          page.query ? t.admin.accountList.noMatch({ q: page.query }) : t.admin.accountList.empty
        }
      />
    );
  }
  return (
    <Table>
      <THead>
        <TRow>
          <TH className="ps-4">{t.admin.accountList.account}</TH>
          {sortHeader('equity', columns.equity)}
          <TH align="end">{columns.cash}</TH>
          <TH align="end">{columns.today}</TH>
          {sortHeader('allTime', columns.allTime)}
          <TH align="end">{columns.positions}</TH>
          <TH align="end">{columns.openOrders}</TH>
          {sortHeader('lastTrade', columns.lastTrade, 'start')}
          <TH align="end">
            <span className="sr-only">{t.common.view}</span>
          </TH>
        </TRow>
      </THead>
      <TBody>
        {page.rows.map((account) => (
          <TRow key={account.id}>
            <TCell className="ps-4">
              <span className="flex items-center gap-2.5">
                <span
                  aria-hidden
                  className="bg-surface-3 text-fg-2 type-avatar-sm grid size-8 place-items-center rounded-full"
                >
                  {account.handle.slice(-2)}
                </span>
                <span>
                  <b className="type-sm type-mono text-fg">{account.handle}</b>
                  <span className="type-caption text-fg-3 block">
                    {t.admin.accountList.since({
                      date: f.date(account.createdAt, { weekday: true }),
                    })}
                  </span>
                </span>
              </span>
            </TCell>
            <TCell align="end" className="font-semibold">
              {f.money(cents(account.equityCents))}
            </TCell>
            <TCell align="end" className="text-fg-2">
              {f.money(cents(account.cashCents))}
            </TCell>
            <TCell align="end" className={cn('font-semibold', tone(account.todayCents))}>
              {f.money(cents(account.todayCents), { signed: true })}
            </TCell>
            <TCell align="end">
              <ChangePill
                size="sm"
                value={account.allTimeBps}
                label={`${f.money(cents(account.allTimeCents), { signed: true })} · ${f.percent(bps(account.allTimeBps), { signed: true })}`}
              />
            </TCell>
            <TCell align="end">{f.number(account.positions)}</TCell>
            <TCell align="end">{f.number(account.openOrders)}</TCell>
            <TCell className="text-fg-2">
              {account.lastTradeAt === null
                ? t.admin.states.never
                : f.relative(account.lastTradeAt, page.now)}
            </TCell>
            <TCell align="end">
              <Button
                variant="ghost"
                size="sm"
                aria-label={`${t.common.view} ${account.handle}`}
                onClick={() => {
                  page.actions.view(account);
                }}
              >
                {t.common.view}
              </Button>
            </TCell>
          </TRow>
        ))}
      </TBody>
    </Table>
  );
}

function AccountDrawer({ page }: { page: AccountsPageModel }) {
  const { t, f } = useI18n();
  const account = page.viewing;
  const columns = t.admin.accountColumns;
  return (
    <Drawer
      open={account !== null}
      onOpenChange={(open) => {
        if (!open) page.actions.closeView();
      }}
      title={account ? t.admin.accountList.details({ handle: account.handle }) : ''}
      closeLabel={t.common.close}
      footer={
        account ? (
          <GuardedButton
            locked={!page.canEdit}
            variant="danger"
            icon={<RotateCcw aria-hidden className="size-4" />}
            onClick={() => {
              page.actions.openReset(account);
            }}
          >
            {t.admin.resetAccount}
          </GuardedButton>
        ) : null
      }
    >
      {account ? (
        <>
          <EstimateRows
            rows={[
              { label: columns.equity, value: f.money(cents(account.equityCents)) },
              { label: columns.cash, value: f.money(cents(account.cashCents)) },
              { label: columns.today, value: f.money(cents(account.todayCents), { signed: true }) },
              {
                label: columns.allTime,
                value: `${f.money(cents(account.allTimeCents), { signed: true })} · ${f.percent(bps(account.allTimeBps), { signed: true })}`,
              },
              { label: columns.positions, value: f.number(account.positions) },
              { label: columns.openOrders, value: f.number(account.openOrders) },
              {
                label: columns.lastTrade,
                value:
                  account.lastTradeAt === null
                    ? t.admin.states.never
                    : f.dateTime(account.lastTradeAt),
              },
              { label: t.admin.accountList.created, value: f.dateTime(account.createdAt) },
            ]}
          />
          <Callout tone="info" icon={<ShieldCheck />}>
            {t.admin.accountsNote}
          </Callout>
        </>
      ) : null}
    </Drawer>
  );
}

export function AccountsPage() {
  const page = useAccountsPage();
  const { t, f } = useI18n();

  return (
    <>
      <PageHeader
        title={t.admin.accounts}
        subtitle={t.admin.accountsSub({
          ...f.count(page.total),
          start: f.money(page.startingCashCents),
        })}
      >
        <Input
          type="search"
          icon={<Search />}
          className="w-75"
          aria-label={t.admin.accountList.searchLabel}
          placeholder={t.admin.searchAccounts}
          value={page.search}
          onChange={(event) => {
            page.actions.search(event.target.value);
          }}
        />
      </PageHeader>
      {page.resetDone ? (
        <Callout tone="info" role="status">
          {t.admin.accountList.resetDone({ handle: page.resetDone })}
        </Callout>
      ) : null}
      <Card className="flex flex-col overflow-hidden">
        <AccountsTable page={page} />
        {page.total > 0 ? (
          <Pagination
            page={page.page}
            pageSize={ACCOUNTS_PAGE_SIZE}
            total={page.total}
            onPage={page.actions.setPage}
          />
        ) : null}
      </Card>
      <Callout tone="info" icon={<ShieldCheck />}>
        {t.admin.accountsNote} {t.admin.resetBody({ start: f.money(page.startingCashCents) })}
      </Callout>
      <AccountDrawer page={page} />
      <ResetDialog
        reset={page.reset}
        startingCashCents={page.startingCashCents}
        onClose={page.actions.closeReset}
        onConfirmText={page.actions.setConfirmText}
        onConfirm={page.actions.confirmReset}
      />
    </>
  );
}
