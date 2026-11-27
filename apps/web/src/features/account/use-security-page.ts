import { useState } from 'react';

import { type CustomerUser, type SessionInfo } from '@sarwa/contracts';
import {
  useChangePassword,
  useNow,
  useResendVerification,
  useRevokeSession,
  useSessions,
  useSignOutOthers,
  useUpdateProfile,
} from '@sarwa/core';

import { useCopy } from '../../lib/i18n';
import {
  type AuthProblem,
  type FieldError,
  fieldErrors,
  type PasswordCheck,
  passwordCheck,
  type ResendState,
  resendState,
} from '../auth/auth-view';
import { useSavedToast } from '../gating/auth-toasts';

export interface ProfileView {
  user: CustomerUser;
  resend: ResendState;
  edit: { open: boolean; name: string; error?: FieldError; isPending: boolean };
  actions: {
    resendVerification: () => void;
    openEdit: () => void;
    closeEdit: () => void;
    setName: (value: string) => void;
    saveName: () => void;
  };
}

export interface ChangePasswordView {
  open: boolean;
  values: { current: string; next: string; confirm: string };
  errors: Partial<Record<'current' | 'next' | 'confirm', FieldError>>;
  // 400 INVALID_CURRENT_PASSWORD, shown inline under the current password.
  currentIncorrect: boolean;
  password: PasswordCheck;
  matches: boolean;
  problem: AuthProblem | null;
  isPending: boolean;
  actions: {
    open: () => void;
    cancel: () => void;
    setCurrent: (value: string) => void;
    setNext: (value: string) => void;
    setConfirm: (value: string) => void;
    submit: () => void;
  };
}

export interface SessionsView {
  status: 'loading' | 'error' | 'ready';
  items: SessionInfo[];
  revokingId: string | null;
  confirmOthers: boolean;
  isRevokingOthers: boolean;
  actions: {
    revoke: (id: string) => void;
    askSignOutOthers: () => void;
    cancelSignOutOthers: () => void;
    confirmSignOutOthers: () => void;
    retry: () => void;
  };
}

// /settings/security: Profile and Security render together.
export interface SecurityPageView {
  now: number;
  profile: ProfileView;
  password: ChangePasswordView;
  sessions: SessionsView;
}

function useProfile(user: CustomerUser): ProfileView {
  const { t } = useCopy();
  const saved = useSavedToast();
  const resend = useResendVerification();
  const update = useUpdateProfile({
    onSuccess: () => {
      saved(t.toasts.profileSaved);
    },
  });
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name);
  return {
    user,
    resend: resendState(resend),
    edit: {
      // A saved name closes the dialog; reopening starts from the current name.
      open: editing && !update.isSuccess,
      name,
      error: fieldErrors(update.fieldErrors, ['name'] as const).name,
      isPending: update.isPending,
    },
    actions: {
      resendVerification: () => {
        resend.resend();
      },
      openEdit: () => {
        update.reset();
        setName(user.name);
        setEditing(true);
      },
      closeEdit: () => {
        setEditing(false);
      },
      setName,
      saveName: () => {
        update.submit({ name });
      },
    },
  };
}

const EMPTY_PASSWORDS = { current: '', next: '', confirm: '' };
const PASSWORD_FIELDS = ['current', 'next', 'confirm'] as const;

function useChangePasswordForm(): ChangePasswordView {
  const { t } = useCopy();
  const saved = useSavedToast();
  const form = useChangePassword({
    onSuccess: () => {
      saved(t.toasts.passwordUpdated);
    },
  });
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState(EMPTY_PASSWORDS);
  const currentIncorrect = form.error === 'INVALID_CURRENT_PASSWORD';
  const set = (patch: Partial<typeof values>) => {
    setValues((current) => ({ ...current, ...patch }));
  };
  return {
    open: editing && !form.isSuccess,
    values,
    errors: fieldErrors(form.fieldErrors, PASSWORD_FIELDS),
    currentIncorrect,
    password: passwordCheck(values.next),
    matches: values.confirm.length > 0 && values.confirm === values.next,
    problem: currentIncorrect ? null : form.error,
    isPending: form.isPending,
    actions: {
      open: () => {
        form.reset();
        setValues(EMPTY_PASSWORDS);
        setEditing(true);
      },
      cancel: () => {
        setEditing(false);
      },
      setCurrent: (current) => {
        set({ current });
      },
      setNext: (next) => {
        set({ next });
      },
      setConfirm: (confirm) => {
        set({ confirm });
      },
      submit: () => {
        form.submit(values);
      },
    },
  };
}

function useSessionsList(): SessionsView {
  const sessions = useSessions();
  const revoke = useRevokeSession();
  const signOutOthers = useSignOutOthers();
  const [confirmOthers, setConfirmOthers] = useState(false);
  return {
    status: sessions.isLoading ? 'loading' : sessions.isError ? 'error' : 'ready',
    items: sessions.current ? [sessions.current, ...sessions.others] : sessions.others,
    revokingId: revoke.isPending ? revoke.variables : null,
    confirmOthers,
    isRevokingOthers: signOutOthers.isPending,
    actions: {
      revoke: (id) => {
        revoke.mutate(id);
      },
      askSignOutOthers: () => {
        setConfirmOthers(true);
      },
      cancelSignOutOthers: () => {
        setConfirmOthers(false);
      },
      confirmSignOutOthers: () => {
        signOutOthers.mutate(undefined, {
          onSettled: () => {
            setConfirmOthers(false);
          },
        });
      },
      retry: sessions.retry,
    },
  };
}

// Mounted only for a signed-in customer, so the user is always there.
export function useSecurityPage(user: CustomerUser): SecurityPageView {
  return {
    now: useNow(),
    profile: useProfile(user),
    password: useChangePasswordForm(),
    sessions: useSessionsList(),
  };
}
