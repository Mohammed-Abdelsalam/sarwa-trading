import { useState } from 'react';

import {
  type AuthErrorCode,
  type AuthFieldError,
  type AuthFieldErrors,
  checkPassword,
  NAME_MAX_LENGTH,
  needsNumberOrSymbol,
  PASSWORD_POLICY,
  passwordStrength,
} from '@sarwa/core';

import { type Copy } from '../../lib/i18n';
import { type AuthNotice, type FieldModel, type StrengthModel } from './auth-parts';

// What every core auth form hook returns that the screens render.
export interface AuthFormState {
  error: AuthErrorCode | null;
  fieldErrors: AuthFieldErrors;
  retryIn: string | null;
  retryReady: boolean;
  isPending: boolean;
}

const LIMIT: Partial<Record<AuthFieldError, number>> = {
  NAME_TOO_LONG: NAME_MAX_LENGTH,
  PASSWORD_TOO_LONG: PASSWORD_POLICY.maxLength,
};

export function fieldErrorText(code: AuthFieldError | undefined, { t, f }: Copy) {
  if (!code) return undefined;
  return t.auth.fieldErrors[code]({ n: f.number(LIMIT[code] ?? PASSWORD_POLICY.minLength) });
}

export function authNotice(form: AuthFormState, { t }: Copy): AuthNotice | undefined {
  if (form.retryIn)
    return {
      kind: 'rateLimited',
      message: t.auth.errors.RATE_LIMITED({ time: form.retryIn }),
      hint: t.auth.rateLimitedHint,
    };
  if (form.retryReady) return { kind: 'rateLimited', message: t.auth.retryReady };
  if (!form.error || form.error === 'RATE_LIMITED') return undefined;
  if (form.error === 'OFFLINE') return { kind: 'offline', message: t.auth.errors.OFFLINE };
  return {
    kind: 'error',
    message: t.auth.errors[form.error],
    hint: form.error === 'INVALID_CREDENTIALS' ? t.auth.signIn.invalidHint : undefined,
  };
}

export function strengthOf(password: string): StrengthModel {
  const issues = checkPassword(password);
  return {
    level: passwordStrength(password),
    minLength: !issues.includes('TOO_SHORT') && !issues.includes('TOO_LONG'),
    notCommon: !issues.includes('COMMON'),
    tip: password.length > 0 && needsNumberOrSymbol(password),
  };
}

// Field state for one form; typing clears the server's answer so stale errors never linger.
export function useFields<K extends string>(names: readonly K[], onEdit: () => void) {
  const [values, setValues] = useState(
    () => Object.fromEntries(names.map((name) => [name, ''])) as Record<K, string>,
  );
  const field = (name: K, error?: string): FieldModel => ({
    value: values[name],
    onChange: (text) => {
      setValues((current) => ({ ...current, [name]: text }));
      onEdit();
    },
    error,
  });
  return { values, field };
}

export function submitModel(form: AuthFormState, onSubmit: () => void) {
  return { onSubmit, loading: form.isPending, retryIn: form.retryIn ?? undefined };
}
