import { useState } from 'react';

import { useResetPassword } from '@sarwa/core';

import { useSearchParam } from '../../lib/browser';
import {
  type FieldError,
  fieldErrors,
  formStatus,
  type FormStatus,
  type PasswordCheck,
  passwordCheck,
} from './auth-view';

const FIELDS = ['password', 'confirm'] as const;

export interface ResetPasswordView extends FormStatus {
  // checking: the token is being looked up (GET /auth/reset/:token).
  status: 'checking' | 'form' | 'done' | 'expired';
  email: string | null;
  values: { password: string; confirm: string };
  errors: Partial<Record<(typeof FIELDS)[number], FieldError>>;
  password: PasswordCheck;
  matches: boolean;
  sessionsRevoked: number;
  actions: {
    setPassword: (value: string) => void;
    setConfirm: (value: string) => void;
    submit: () => void;
  };
}

// /reset-password?token=…: a used, expired or mangled link all offer a fresh one.
export function useResetPasswordPage(): ResetPasswordView {
  const form = useResetPassword(useSearchParam('token') ?? '');
  const [values, setValues] = useState({ password: '', confirm: '' });
  const status =
    form.link === 'checking'
      ? 'checking'
      : form.link !== 'ready'
        ? 'expired'
        : form.isSuccess
          ? 'done'
          : 'form';
  return {
    ...formStatus(form),
    status,
    email: form.email,
    values,
    errors: fieldErrors(form.fieldErrors, FIELDS),
    password: passwordCheck(values.password),
    matches: values.confirm.length > 0 && values.confirm === values.password,
    sessionsRevoked: form.sessionsRevoked ?? 0,
    actions: {
      setPassword: (password) => {
        setValues((current) => ({ ...current, password }));
      },
      setConfirm: (confirm) => {
        setValues((current) => ({ ...current, confirm }));
      },
      submit: () => {
        form.submit(values);
      },
    },
  };
}
