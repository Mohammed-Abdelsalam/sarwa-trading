import { useState } from 'react';

import { CreateUserSchema, type Role, type UserStatus } from '@sarwa/contracts';
import {
  isConflict,
  useAdminSession,
  useAdminUsers,
  useCreateUser,
  useUpdateUser,
} from '@sarwa/core/admin';

export type UserFilter = 'all' | UserStatus;
export type UserFieldError = 'emailInvalid' | 'required' | 'passwordShort' | 'exists';

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
  const all = users.data ?? [];
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
    actions: {
      retry: () => void users.refetch(),
      search: setSearch,
      setFilter,
      setRole: (id: string, role: Role) => {
        update.mutate({ id, patch: { role } });
      },
      setStatus: (id: string, status: UserStatus) => {
        update.mutate({ id, patch: { status } });
      },
    },
  };
}

export type UsersPageModel = ReturnType<typeof useUsersPage>;
