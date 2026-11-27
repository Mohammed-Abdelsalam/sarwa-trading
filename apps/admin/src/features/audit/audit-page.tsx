'use client';

import { ChevronDown, ChevronRight, Copy, FileText, Funnel, User } from 'lucide-react';
import { Fragment } from 'react';

import { AUDIT_ACTIONS, type AuditAction } from '@sarwa/contracts';
import { useI18n } from '@sarwa/core';
import { type BadgeTone } from '@sarwa/tokens';
import {
  Badge,
  Button,
  Card,
  IconButton,
  Input,
  StateView,
  Table,
  TBody,
  TCell,
  TH,
  THead,
  TRow,
  Select,
} from '@sarwa/ui';

import { UserAvatar } from '../../components/common/identity';
import { LoadError, PageHeader, Pagination, TableSkeleton } from '../../components/common/states';
import { type ActionFilter, type AuditPageModel, useAuditPage } from './use-audit-page';

function actionTone(action: AuditAction): BadgeTone {
  if (action === 'connections.drop' || action.endsWith('.delete') || action === 'account.reset')
    return 'neg';
  if (action === 'market.pause' || action === 'halt.create') return 'warn';
  if (action.endsWith('.create') || action.endsWith('.resume')) return 'pos';
  if (action === 'config.update' || action === 'auth.login') return 'info';
  return 'brand';
}

type Row = AuditPageModel['rows'][number];

function Details({ row, onCopy }: { row: Row; onCopy: (json: string) => void }) {
  const { t } = useI18n();
  const copy = t.admin.audit;
  return (
    <div className="grid gap-4 pt-3 lg:grid-cols-[minmax(0,1fr)_16.25rem]">
      <div className="flex flex-col gap-3">
        {row.changes.length > 0 ? (
          <table className="border-border bg-bg w-full overflow-hidden rounded-[10px] border text-sm">
            <caption className="sr-only">{copy.changes}</caption>
            <thead>
              <tr className="text-fg-3 text-xs">
                <th scope="col" className="px-3.5 py-2 text-start font-semibold">
                  {copy.field}
                </th>
                <th scope="col" className="px-3.5 py-2 text-start font-semibold">
                  {copy.before}
                </th>
                <th scope="col" className="px-3.5 py-2 text-start font-semibold">
                  {copy.after}
                </th>
              </tr>
            </thead>
            <tbody className="type-mono">
              {row.changes.map((change) => (
                <tr key={change.key} className="border-border border-t">
                  <td className="text-brand-fg px-3.5 py-1.5">{change.key}</td>
                  <td className="text-neg px-3.5 py-1.5 break-all">{change.before ?? '—'}</td>
                  <td className="text-pos px-3.5 py-1.5 break-all">{change.after ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        <pre
          role="region"
          aria-label={copy.payloadLabel}
          className="border-border bg-bg type-mono text-fg-2 max-h-60 overflow-auto rounded-[10px] border px-3.5 py-3 text-xs leading-5"
        >
          {row.json}
        </pre>
      </div>
      <div className="type-sm flex flex-col gap-2.5">
        <div>
          <div className="type-overline text-fg-3">{copy.eventId}</div>
          <div className="type-mono">{row.id}</div>
        </div>
        <div>
          <div className="type-overline text-fg-3">{copy.ip}</div>
          <div className="text-fg-2">{row.ip ?? '—'}</div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="self-start"
          icon={<Copy aria-hidden className="size-3.5" />}
          onClick={() => {
            onCopy(row.json);
          }}
        >
          {copy.copy}
        </Button>
      </div>
    </div>
  );
}

function AuditTable({ page }: { page: AuditPageModel }) {
  const { t, f } = useI18n();
  const copy = t.admin.audit;
  if (page.isError) return <LoadError what={copy.loading} onRetry={page.actions.retry} />;
  if (page.isLoading) return <TableSkeleton columns={6} rows={8} label={copy.loading} />;
  if (page.rows.length === 0) {
    return (
      <StateView
        className="flex-1 justify-center"
        icon={<FileText />}
        title={page.filtered ? copy.empty : copy.emptyAll}
        action={
          page.filtered ? (
            <Button variant="secondary" size="sm" onClick={page.actions.clear}>
              {copy.clear}
            </Button>
          ) : undefined
        }
      />
    );
  }
  return (
    <Table>
      <THead>
        <TRow>
          <TH className="w-11">
            <span className="sr-only">{copy.expand}</span>
          </TH>
          <TH aria-sort="descending">{copy.columns.time}</TH>
          <TH>{copy.columns.actor}</TH>
          <TH>{copy.columns.action}</TH>
          <TH>{copy.columns.entity}</TH>
          <TH>{copy.columns.payload}</TH>
        </TRow>
      </THead>
      <TBody>
        {page.rows.map((row) => {
          const open = page.expanded === row.id;
          return (
            <Fragment key={row.id}>
              <TRow className={open ? '[&>td]:bg-surface-3' : undefined}>
                <TCell className="pe-0">
                  <IconButton
                    size={32}
                    aria-expanded={open}
                    label={open ? copy.collapse : copy.expand}
                    onClick={() => {
                      page.actions.toggle(row.id);
                    }}
                  >
                    {open ? (
                      <ChevronDown aria-hidden className="size-4" />
                    ) : (
                      <ChevronRight aria-hidden className="size-4 rtl:-scale-x-100" />
                    )}
                  </IconButton>
                </TCell>
                <TCell className="tabular-nums">
                  <div className="font-semibold">{f.time(row.at, { seconds: true })}</div>
                  <div className="type-caption text-fg-3">{f.date(row.at, { weekday: true })}</div>
                </TCell>
                <TCell>
                  <span className="flex items-center gap-2">
                    <UserAvatar name={row.actorEmail} className="size-7 text-xs" />
                    {row.actorEmail}
                  </span>
                </TCell>
                <TCell>
                  <Badge square tone={actionTone(row.action)} className="type-mono font-medium">
                    {row.action}
                  </Badge>
                </TCell>
                <TCell>{row.entity}</TCell>
                <TCell className="type-mono text-fg-2 max-w-90 truncate">{row.preview}</TCell>
              </TRow>
              {open ? (
                <tr>
                  <td
                    colSpan={6}
                    className="bg-surface-3 border-border border-b px-4 ps-14 pt-1 pb-4 whitespace-normal"
                  >
                    <Details row={row} onCopy={page.actions.copy} />
                  </td>
                </tr>
              ) : null}
            </Fragment>
          );
        })}
      </TBody>
    </Table>
  );
}

export function AuditPage() {
  const page = useAuditPage();
  const { t, f } = useI18n();
  const copy = t.admin.audit;

  return (
    <>
      <PageHeader title={copy.title} subtitle={copy.subtitle({ n: f.number(page.total) })} />
      <div role="group" aria-label={copy.filters} className="flex flex-wrap items-center gap-2.5">
        <Input
          type="search"
          icon={<User />}
          className="w-60"
          aria-label={copy.actor}
          placeholder={copy.actorPlaceholder}
          value={page.actor}
          onChange={(event) => {
            page.actions.setActor(event.target.value);
          }}
        />
        <span className="relative flex items-center">
          <Funnel aria-hidden className="text-fg-3 pointer-events-none absolute start-3 size-4" />
          <Select
            aria-label={copy.action}
            className="w-56 ps-9"
            value={page.action}
            onChange={(event) => {
              page.actions.setAction(event.target.value as ActionFilter);
            }}
          >
            <option value="all">{copy.allActions}</option>
            {AUDIT_ACTIONS.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </Select>
        </span>
        <div className="flex-1" />
        {page.filtered ? (
          <Button variant="ghost" size="sm" onClick={page.actions.clear}>
            {copy.clear}
          </Button>
        ) : null}
      </div>
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <AuditTable page={page} />
        {page.total > 0 ? (
          <Pagination
            page={page.page}
            pageSize={page.pageSize}
            total={page.total}
            onPage={page.actions.setPage}
          />
        ) : null}
      </Card>
    </>
  );
}
