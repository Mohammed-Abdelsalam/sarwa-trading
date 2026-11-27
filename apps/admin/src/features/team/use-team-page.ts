import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import {
  AUTH_TTL_MS,
  CreateInviteRequestSchema,
  type Role,
  type UpdateUser,
  type UserStatus,
} from '@sarwa/contracts';
import {
  useAdminI18n,
  useAdminSession,
  useAdminUsers,
  useCreateInvite,
  useInvites,
  useResendInvite,
  useRevokeInvite,
  useUpdateUser,
} from '@sarwa/core/admin';

import { useToast } from '../../components/common/toasts';
import { oneOf, setSearchParams, useSearchParamText } from '../../lib/search-params';
import { type InviteDialogView } from './invite-dialog';
import { type TeamConfirm, type TeamFilter, type TeamView } from './team-page';

const STATUSES: readonly UserStatus[] = ['active', 'disabled'];
const HOUR_MS = 3_600_000;

type LoadState = 'loading' | 'error' | 'ready';
const loadState = (query: { isPending: boolean; isError: boolean; data?: unknown }): LoadState =>
  query.isError && !query.data ? 'error' : query.isPending ? 'loading' : 'ready';

function useInviteDialog(): InviteDialogView {
  const create = useCreateInvite();
  const { t } = useAdminI18n();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('VIEWER');
  const [submitted, setSubmitted] = useState(false);
  const parsed = CreateInviteRequestSchema.safeParse({ email: email.trim(), role });
  return {
    open,
    email,
    role,
    emailInvalid: submitted && !parsed.success,
    isSending: create.isPending,
    failed: create.isError,
    validHours: AUTH_TTL_MS.adminInvite / HOUR_MS,
    actions: {
      open: () => {
        create.reset();
        setEmail('');
        setRole('VIEWER');
        setSubmitted(false);
        setOpen(true);
      },
      close: () => {
        setOpen(false);
      },
      setEmail,
      setRole,
      submit: () => {
        setSubmitted(true);
        if (!parsed.success) return;
        create.mutate(parsed.data, {
          onSuccess: () => {
            setOpen(false);
            toast(t.admin.team.toasts.sent({ email: parsed.data.email }));
          },
        });
      },
    },
  };
}

export function useTeamPage(): TeamView {
  const session = useAdminSession();
  const users = useAdminUsers({ enabled: session.canEdit });
  const invites = useInvites({ enabled: session.canEdit });
  const update = useUpdateUser();
  const revoke = useRevokeInvite();
  const resend = useResendInvite();
  const invite = useInviteDialog();
  const { t } = useAdminI18n();
  const toast = useToast();
  const params = useSearchParams();
  const search = useSearchParamText(params, 'q');
  const filter = oneOf<TeamFilter>(params.get('status'), STATUSES, 'all');
  const [confirm, setConfirm] = useState<TeamConfirm | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const all = users.data ?? [];
  const inviteRows = invites.data?.items ?? [];
  const activeAdmins = all.filter((user) => user.role === 'ADMIN' && user.status === 'active');
  const q = search.text.trim().toLowerCase();
  const ask = (kind: TeamConfirm['kind'], id: string) => {
    const user = all.find((row) => row.id === id);
    if (!user) return;
    update.reset();
    setConfirm({ kind, user });
  };

  return {
    me: session.user,
    forbidden: session.user !== null && !session.canEdit,
    canEdit: session.canEdit,
    members: all
      .filter(
        (user) =>
          (filter === 'all' || user.status === filter) &&
          (!q || user.email.toLowerCase().includes(q) || user.name.toLowerCase().includes(q)),
      )
      .map((user) => {
        const you = user.id === session.user?.id;
        const lastAdmin = activeAdmins.length === 1 && activeAdmins[0]?.id === user.id;
        return { user, you, locked: you || lastAdmin };
      }),
    counts: {
      total: all.length,
      admins: all.filter((user) => user.role === 'ADMIN').length,
      viewers: all.filter((user) => user.role === 'VIEWER').length,
    },
    status: loadState(users),
    search: search.text,
    filter,
    failed: confirm === null && update.isError,
    now: users.dataUpdatedAt,
    confirm: {
      request: confirm,
      isSaving: update.isPending,
      failed: confirm !== null && update.isError,
    },
    invites: {
      rows: inviteRows,
      status: loadState(invites),
      revoking: inviteRows.find((row) => row.id === revokingId) ?? null,
      resendingId: resend.isPending ? resend.variables : null,
      isRevoking: revoke.isPending,
      revokeFailed: revoke.isError,
    },
    invite,
    actions: {
      retry: () => void users.refetch(),
      search: search.set,
      setFilter: (next) => {
        setSearchParams({ status: next === 'all' ? null : next });
      },
      setRole: (id, role) => {
        if (role === 'VIEWER') ask('demote', id);
        else update.mutate({ id, patch: { role } });
      },
      setStatus: (id, status) => {
        if (status === 'disabled') ask('disable', id);
        else update.mutate({ id, patch: { status } });
      },
      confirm: () => {
        if (!confirm) return;
        const patch: UpdateUser =
          confirm.kind === 'disable' ? { status: 'disabled' } : { role: 'VIEWER' };
        update.mutate(
          { id: confirm.user.id, patch },
          {
            onSuccess: () => {
              setConfirm(null);
            },
          },
        );
      },
      cancelConfirm: () => {
        setConfirm(null);
      },
      retryInvites: () => void invites.refetch(),
      resend: (id) => {
        resend.mutate(id, {
          onSuccess: (row) => {
            toast(t.admin.team.toasts.sent({ email: row.email }));
          },
        });
      },
      askRevoke: (id) => {
        revoke.reset();
        setRevokingId(id);
      },
      confirmRevoke: () => {
        if (!revokingId) return;
        revoke.mutate(revokingId, {
          onSuccess: () => {
            setRevokingId(null);
            toast(t.admin.team.toasts.revoked);
          },
        });
      },
      cancelRevoke: () => {
        setRevokingId(null);
      },
    },
  };
}
