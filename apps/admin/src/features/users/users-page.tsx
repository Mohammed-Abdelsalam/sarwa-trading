'use client';

import { Ban, Check, ChevronDown, Eye, Info, Search, Shield, UserPlus } from 'lucide-react';

import { RoleSchema } from '@sarwa/contracts';
import { useI18n } from '@sarwa/core';
import {
  Badge,
  Button,
  Callout,
  Card,
  Input,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  SegmentedControl,
  Table,
  TBody,
  TCell,
  TH,
  THead,
  TRow,
} from '@sarwa/ui';

import { Forbidden } from '../../components/common/access';
import { RoleBadge, UserAvatar } from '../../components/common/identity';
import { LoadError, PageHeader, TableSkeleton } from '../../components/common/states';
import { AddUserDialog } from './add-user-dialog';
import { type UserFilter, type UsersPageModel, useUsersPage } from './use-users-page';

const FILTERS: readonly UserFilter[] = ['all', 'active', 'disabled'];

function UsersTable({ page }: { page: UsersPageModel }) {
  const { t, f } = useI18n();
  const copy = t.admin.users;
  if (page.isError) return <LoadError what={copy.loading} onRetry={page.actions.retry} />;
  if (page.isLoading) return <TableSkeleton columns={5} rows={5} label={copy.loading} />;
  if (page.rows.length === 0) {
    return <p className="type-sm text-fg-2 px-5 py-10 text-center">{copy.noMatch}</p>;
  }
  return (
    <Table>
      <THead>
        <TRow>
          <TH className="ps-5">{copy.columns.user}</TH>
          <TH>{copy.columns.role}</TH>
          <TH>{copy.columns.status}</TH>
          <TH>{copy.columns.lastActive}</TH>
          <TH align="end">
            <span className="sr-only">{t.admin.stocks.columns.actions}</span>
          </TH>
        </TRow>
      </THead>
      <TBody>
        {page.rows.map((user) => {
          const you = user.id === page.me?.id;
          const disabled = user.status === 'disabled';
          return (
            <TRow key={user.id}>
              <TCell className="ps-5">
                <span className="flex items-center gap-3">
                  <UserAvatar name={user.name} />
                  <span>
                    <span className="text-fg flex items-center gap-1.5 font-semibold">
                      {user.name}
                      {you ? <Badge className="h-4.5 text-[0.6875rem]">{copy.you}</Badge> : null}
                    </span>
                    <span className="type-caption text-fg-3">{user.email}</span>
                  </span>
                </span>
              </TCell>
              <TCell>
                <Menu>
                  <MenuTrigger
                    disabled={you}
                    aria-label={copy.roleFor({ email: user.email })}
                    className="border-border-strong bg-surface dark:bg-surface-2 focus-visible:outline-focus flex h-8.5 w-32 cursor-pointer items-center justify-between rounded-md border px-2.5 focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RoleBadge role={user.role} />
                    <ChevronDown aria-hidden className="text-fg-3 size-3.5" />
                  </MenuTrigger>
                  <MenuContent align="start" className="w-70">
                    {RoleSchema.options.map((role) => (
                      <MenuItem
                        key={role}
                        className="h-auto items-start py-2.5"
                        icon={role === 'ADMIN' ? <Shield /> : <Eye />}
                        onSelect={() => {
                          if (role !== user.role) page.actions.setRole(user.id, role);
                        }}
                      >
                        <span className="flex-1">
                          <b>{t.admin.roles[role]}</b>
                          <span className="type-caption text-fg-3 block whitespace-normal">
                            {copy.roleHints[role]}
                          </span>
                        </span>
                        {role === user.role ? (
                          <Check aria-hidden className="text-brand-fg size-4" />
                        ) : null}
                      </MenuItem>
                    ))}
                  </MenuContent>
                </Menu>
              </TCell>
              <TCell>
                <Badge tone={disabled ? 'neg' : 'pos'}>{copy.statuses[user.status]}</Badge>
              </TCell>
              <TCell className="text-fg-2 tabular-nums">
                {user.lastActiveAt === null
                  ? t.admin.states.never
                  : f.relative(Date.parse(user.lastActiveAt), page.now)}
              </TCell>
              <TCell align="end">
                <Button
                  size="sm"
                  variant={disabled ? 'secondary' : 'ghost'}
                  disabled={you}
                  icon={
                    disabled ? (
                      <Check aria-hidden className="size-3.5" />
                    ) : (
                      <Ban aria-hidden className="size-3.5" />
                    )
                  }
                  onClick={() => {
                    page.actions.setStatus(user.id, disabled ? 'active' : 'disabled');
                  }}
                >
                  {disabled ? copy.enable : copy.disable}
                </Button>
              </TCell>
            </TRow>
          );
        })}
      </TBody>
    </Table>
  );
}

export function UsersPage() {
  const page = useUsersPage();
  const { t, f } = useI18n();
  const copy = t.admin.users;

  if (page.forbidden) return <Forbidden page={t.admin.nav.users} user={page.me} />;

  return (
    <>
      <PageHeader
        title={copy.title}
        subtitle={
          page.isLoading
            ? undefined
            : copy.subtitle({
                n: f.number(page.counts.total),
                admins: f.number(page.counts.admins),
                viewers: f.number(page.counts.viewers),
              })
        }
      >
        <Button
          icon={<UserPlus aria-hidden className="size-4" />}
          disabled={page.sessionLoading}
          onClick={page.add.actions.open}
        >
          {copy.add}
        </Button>
      </PageHeader>
      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="search"
          icon={<Search />}
          className="w-80"
          aria-label={copy.searchLabel}
          placeholder={copy.search}
          value={page.search}
          onChange={(event) => {
            page.actions.search(event.target.value);
          }}
        />
        <SegmentedControl
          label={copy.filter}
          options={FILTERS.map((value) => ({ value, label: copy.filters[value] }))}
          value={page.filter}
          onChange={page.actions.setFilter}
        />
      </div>
      {page.failed ? (
        <Callout tone="neg" urgent>
          {t.admin.states.actionFailed}
        </Callout>
      ) : null}
      <Card className="overflow-hidden">
        <UsersTable page={page} />
      </Card>
      <Callout tone="info" icon={<Info />}>
        {copy.note} <span className="type-mono">user.role</span>.
      </Callout>
      <AddUserDialog add={page.add} />
    </>
  );
}
