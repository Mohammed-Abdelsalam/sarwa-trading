'use client';

import {
  Ban,
  Check,
  ChevronDown,
  Eye,
  Info,
  Lock,
  Search,
  Send,
  Shield,
  UserPlus,
  X,
} from 'lucide-react';

import {
  type AdminUser,
  type InviteRow,
  type Role,
  RoleSchema,
  type UserStatus,
} from '@sarwa/contracts';
import { useAdminI18n } from '@sarwa/core/admin';
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
import { ConfirmDialog } from '../../components/common/confirm-dialog';
import { RoleBadge, UserAvatar } from '../../components/common/identity';
import { LoadError, PageHeader, TableSkeleton } from '../../components/common/states';
import { InviteDialog, type InviteDialogView } from './invite-dialog';
import { useTeamPage } from './use-team-page';

export type TeamFilter = 'all' | UserStatus;
type LoadState = 'loading' | 'error' | 'ready';

export interface TeamMember {
  user: AdminUser;
  you: boolean;
  // Your own row, and the last active ADMIN, can't be demoted or disabled.
  locked: boolean;
}

export interface TeamConfirm {
  kind: 'disable' | 'demote';
  user: AdminUser;
}

export interface TeamView {
  me: AdminUser | null;
  forbidden: boolean;
  canEdit: boolean;
  members: readonly TeamMember[];
  counts: { total: number; admins: number; viewers: number };
  status: LoadState;
  search: string;
  filter: TeamFilter;
  failed: boolean;
  now: number;
  confirm: { request: TeamConfirm | null; isSaving: boolean; failed: boolean };
  invites: {
    rows: readonly InviteRow[];
    status: LoadState;
    revoking: InviteRow | null;
    resendingId: string | null;
    isRevoking: boolean;
    revokeFailed: boolean;
  };
  invite: InviteDialogView;
  actions: {
    retry: () => void;
    search: (text: string) => void;
    setFilter: (filter: TeamFilter) => void;
    setRole: (id: string, role: Role) => void;
    setStatus: (id: string, status: UserStatus) => void;
    confirm: () => void;
    cancelConfirm: () => void;
    retryInvites: () => void;
    resend: (id: string) => void;
    askRevoke: (id: string) => void;
    confirmRevoke: () => void;
    cancelRevoke: () => void;
  };
}

const FILTERS: readonly TeamFilter[] = ['all', 'active', 'disabled'];

function MembersTable({ view }: { view: TeamView }) {
  const { t, f } = useAdminI18n();
  const copy = t.admin.users;
  if (view.status === 'error')
    return <LoadError what={copy.loading} onRetry={view.actions.retry} />;
  if (view.status === 'loading') return <TableSkeleton columns={5} rows={5} label={copy.loading} />;
  if (view.members.length === 0) {
    return <p className="type-sm text-fg-2 px-5 py-10 text-center">{copy.noMatch}</p>;
  }
  return (
    <Table label={t.admin.team.title}>
      <THead>
        <TRow>
          <TH className="ps-5">{copy.columns.user}</TH>
          <TH>{copy.columns.role}</TH>
          <TH>{copy.columns.status}</TH>
          <TH className="max-md:hidden">{copy.columns.lastActive}</TH>
          <TH align="end" className="pe-5">
            <span className="sr-only">{t.admin.team.invites.columns.actions}</span>
          </TH>
        </TRow>
      </THead>
      <TBody>
        {view.members.map(({ user, you, locked }) => {
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
                    disabled={locked}
                    aria-label={copy.roleFor({ email: user.email })}
                    className="border-border-strong bg-surface dark:bg-surface-2 focus-visible:outline-focus flex h-8.5 w-32 cursor-pointer items-center justify-between rounded-md border px-2.5 focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RoleBadge role={user.role} />
                    {locked ? (
                      <Lock aria-hidden className="text-fg-3 size-3.5" />
                    ) : (
                      <ChevronDown aria-hidden className="text-fg-3 size-3.5" />
                    )}
                  </MenuTrigger>
                  <MenuContent align="start" className="w-70">
                    {RoleSchema.options.map((role) => (
                      <MenuItem
                        key={role}
                        className="h-auto items-start py-2.5"
                        icon={role === 'ADMIN' ? <Shield /> : <Eye />}
                        onSelect={() => {
                          if (role !== user.role) view.actions.setRole(user.id, role);
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
              <TCell className="text-fg-2 tabular-nums max-md:hidden">
                {user.lastActiveAt === null
                  ? t.admin.states.never
                  : f.relative(Date.parse(user.lastActiveAt), view.now)}
              </TCell>
              <TCell align="end" className="pe-5">
                <Button
                  size="sm"
                  variant={disabled ? 'secondary' : 'ghost'}
                  disabled={locked}
                  icon={
                    locked ? (
                      <Lock aria-hidden className="size-3.5" />
                    ) : disabled ? (
                      <Check aria-hidden className="size-3.5" />
                    ) : (
                      <Ban aria-hidden className="size-3.5" />
                    )
                  }
                  onClick={() => {
                    view.actions.setStatus(user.id, disabled ? 'active' : 'disabled');
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

function InvitesCard({ view }: { view: TeamView }) {
  const { t, f } = useAdminI18n();
  const copy = t.admin.team.invites;
  const { invites } = view;
  let body;
  if (invites.status === 'error') {
    body = <LoadError what={copy.title} onRetry={view.actions.retryInvites} />;
  } else if (invites.status === 'loading') {
    body = <TableSkeleton columns={4} rows={2} label={copy.title} />;
  } else if (invites.rows.length === 0) {
    body = <p className="type-sm text-fg-2 px-5 py-6 text-center">{copy.empty}</p>;
  } else {
    body = (
      <Table label={copy.title}>
        <THead>
          <TRow>
            <TH className="ps-5">{copy.columns.email}</TH>
            <TH>{copy.columns.role}</TH>
            <TH className="max-md:hidden">{copy.columns.invitedBy}</TH>
            <TH>{copy.columns.expires}</TH>
            <TH align="end" className="pe-5">
              <span className="sr-only">{copy.columns.actions}</span>
            </TH>
          </TRow>
        </THead>
        <TBody>
          {invites.rows.map((invite) => (
            <TRow key={invite.id}>
              <TCell className="text-fg ps-5 font-semibold">{invite.email}</TCell>
              <TCell>
                <RoleBadge role={invite.role} />
              </TCell>
              <TCell className="text-fg-2 max-md:hidden">{invite.invitedBy}</TCell>
              <TCell className="text-fg-2 tabular-nums">
                {invite.status === 'expired' ? (
                  <Badge tone="warn">{copy.expired}</Badge>
                ) : (
                  f.relative(Date.parse(invite.expiresAt), view.now)
                )}
              </TCell>
              <TCell align="end" className="pe-5 whitespace-nowrap">
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={t.admin.team.resendInvite({ email: invite.email })}
                  icon={<Send aria-hidden className="size-3.5" />}
                  loading={invites.resendingId === invite.id}
                  onClick={() => {
                    view.actions.resend(invite.id);
                  }}
                >
                  {copy.resend}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={t.admin.team.revokeInvite({ email: invite.email })}
                  icon={<X aria-hidden className="size-3.5" />}
                  onClick={() => {
                    view.actions.askRevoke(invite.id);
                  }}
                >
                  {copy.revoke}
                </Button>
              </TCell>
            </TRow>
          ))}
        </TBody>
      </Table>
    );
  }
  return (
    <Card className="overflow-hidden" aria-labelledby="team-invites">
      <h2 id="team-invites" className="type-h3 text-fg px-5 pt-4 pb-2">
        {copy.title}
      </h2>
      {body}
    </Card>
  );
}

export function TeamPage({ view }: { view: TeamView }) {
  const { t, f } = useAdminI18n();
  const copy = t.admin.team;
  const users = t.admin.users;
  const request = view.confirm.request;
  const confirmCopy = request?.kind === 'demote' ? users.confirmDemote : users.confirmDisable;
  const revoking = view.invites.revoking;

  if (view.forbidden) return <Forbidden page={t.admin.nav.team} user={view.me} />;

  return (
    <>
      <PageHeader
        title={copy.title}
        subtitle={
          view.status === 'ready'
            ? copy.subtitle({
                n: f.number(view.counts.total),
                admins: f.number(view.counts.admins),
                viewers: f.number(view.counts.viewers),
              })
            : undefined
        }
      >
        <Button
          icon={<UserPlus aria-hidden className="size-4" />}
          disabled={!view.canEdit}
          onClick={view.invite.actions.open}
        >
          {copy.invite}
        </Button>
      </PageHeader>
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-80 max-sm:w-full">
          <Input
            type="search"
            icon={<Search />}
            className="w-full"
            aria-label={users.searchLabel}
            placeholder={users.search}
            value={view.search}
            onChange={(event) => {
              view.actions.search(event.target.value);
            }}
          />
        </div>
        <SegmentedControl
          label={users.filter}
          options={FILTERS.map((value) => ({ value, label: users.filters[value] }))}
          value={view.filter}
          onChange={view.actions.setFilter}
        />
      </div>
      {view.failed ? (
        <Callout tone="neg" urgent>
          {t.admin.states.actionFailed}
        </Callout>
      ) : null}
      <Card className="overflow-hidden">
        <MembersTable view={view} />
      </Card>
      <InvitesCard view={view} />
      <Callout tone="info" icon={<Info />}>
        {users.note} <span className="type-mono">user.role</span>.
      </Callout>
      <InviteDialog invite={view.invite} />
      <ConfirmDialog
        open={request !== null}
        title={confirmCopy.title({ email: request?.user.email ?? '' })}
        body={confirmCopy.body}
        submit={confirmCopy.submit}
        isSaving={view.confirm.isSaving}
        failed={view.confirm.failed}
        onConfirm={view.actions.confirm}
        onCancel={view.actions.cancelConfirm}
      />
      <ConfirmDialog
        open={revoking !== null}
        title={copy.invites.revokeTitle({ email: revoking?.email ?? '' })}
        body={copy.invites.revokeBody}
        submit={copy.invites.revoke}
        isSaving={view.invites.isRevoking}
        failed={view.invites.revokeFailed}
        onConfirm={view.actions.confirmRevoke}
        onCancel={view.actions.cancelRevoke}
      />
    </>
  );
}

export function TeamScreen() {
  return <TeamPage view={useTeamPage()} />;
}
