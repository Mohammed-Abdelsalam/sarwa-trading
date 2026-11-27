import { useState } from 'react';

import {
  type AdminUser,
  CreateUserSchema,
  type Role,
  type UpdateUser,
  type UserStatus,
} from '@sarwa/contracts';
import {
  isConflict,
  useAdminSession,
  useAdminUsers,
  useCreateUser,
  useUpdateUser,
} from '@sarwa/core/admin';

export type UserFilter = 'all' | UserStatus;
export type UserFieldError = 'emailInvalid' | 'required' | 'passwordShort' | 'exists';
export interface UserConfirm {
  kind: 'disable' | 'demote';
  user: AdminUser;
}

const EMPTY = { email: '', name: '', password: '', role: 'VIEWER' as Role };

function useAddUser() {
  const create = useCreateUser();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [submitted, setSubmitted] = useState(false);
  const parsed = CreateUserSchema.safeParse({ ...form, email: form.email.trim() });
  const errors: Partial<Record<'email' | 'name' | 'password', UserFieldError>> = {};
  if (submitted && !parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (key === 'email') errors.email = 'emailInvalid';
      if (key === 'name') errors.name = 'required';
      if (key === 'password') errors.password = 'passwordShort';
    }
  }
  if (submitted && isConflict(create.error)) errors.email = 'exists';

  return {
    open,
    form,
    errors,
    isSaving: create.isPending,
    failed: create.isError && !isConflict(create.error),
    actions: {
      open: () => {
        create.reset();
        setForm(EMPTY);
        setSubmitted(false);
        setOpen(true);
      },
      close: () => {
        setOpen(false);
      },
      set: <K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) => {
        if (key === 'email') create.reset();
        setForm((current) => ({ ...current, [key]: value }));
      },
      submit: () => {
        setSubmitted(true);
        if (!parsed.success) return;
        create.mutate(parsed.data, {
          onSuccess: () => {
            setOpen(false);
          },
        });
      },
    },
  };
}

export function useUsersPage() {
  const session = useAdminSession();
  const users = useAdminUsers({ enabled: session.canEdit });
  const update = useUpdateUser();
  const add = useAddUser();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<UserFilter>('all');
  const [confirm, setConfirm] = useState<UserConfirm | null>(null);
  const all = users.data ?? [];
  const ask = (kind: UserConfirm['kind'], id: string) => {
    const user = all.find((row) => row.id === id);
    if (!user) return;
    update.reset();
    setConfirm({ kind, user });
  };
  const q = search.trim().toLowerCase();

  return {
    me: session.user,
    forbidden: session.user !== null && !session.canEdit,
    sessionLoading: session.isLoading,
    rows: all.filter(
      (user) =>
        (filter === 'all' || user.status === filter) &&
        (!q || user.email.toLowerCase().includes(q) || user.name.toLowerCase().includes(q)),
    ),
    counts: {
      total: all.length,
      admins: all.filter((user) => user.role === 'ADMIN').length,
      viewers: all.filter((user) => user.role === 'VIEWER').length,
    },
    search,
    filter,
    isLoading: users.isPending,
    isError: users.isError,
    failed: update.isError,
    now: users.dataUpdatedAt,
    add,
    confirm: {
      request: confirm,
      isSaving: update.isPending,
      failed: confirm !== null && update.isError,
    },
    actions: {
      retry: () => void users.refetch(),
      search: setSearch,
      setFilter,
      setRole: (id: string, role: Role) => {
        if (role === 'VIEWER') ask('demote', id);
        else update.mutate({ id, patch: { role } });
      },
      setStatus: (id: string, status: UserStatus) => {
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
    },
  };
}

export type UsersPageModel = ReturnType<typeof useUsersPage>;
