import { type Route } from 'next';

import {
  type AuthFieldErrors,
  checkPassword,
  NAME_MAX_LENGTH,
  needsNumberOrSymbol,
  PASSWORD_POLICY,
  passwordStrength,
} from '@sarwa/core';

import { type Copy } from '../../lib/i18n';

// Field errors and form problems arrive as codes; the components turn them into copy.
export type FieldErrorCode = keyof Copy['t']['auth']['fieldErrors'];
export type AuthProblem = keyof Copy['t']['auth']['errors'];

export interface FieldError {
  code: FieldErrorCode;
  // The limit a length error names ("at least 8 characters").
  n?: number;
}

export type PasswordScore = 0 | 1 | 2 | 3 | 4;

// What the strength meter shows for the password being typed.
export interface PasswordCheck {
  strength: PasswordScore;
  minLength: number;
  longEnough: boolean;
  notCommon: boolean;
  hasNumberOrSymbol: boolean;
}

export type ResendState = 'idle' | 'pending' | 'sent';

// What every auth form shows about its last answer: a banner code and the rate-limit wait.
export interface FormStatus {
  problem: AuthProblem | null;
  // "0:42" in the reader's digits while rate limited.
  retryIn: string | null;
  // The polite "You can try again now" once the wait is over.
  retryReady: boolean;
  isPending: boolean;
}

export const AUTH_ROUTES = {
  home: '/' as Route,
  markets: '/markets' as Route,
  signIn: '/signin' as Route,
  signUp: '/signup' as Route,
  forgot: '/forgot-password' as Route,
  suspended: '/suspended' as Route,
} as const;

// Pages that bring their own chrome instead of the app's top bar.
const CHROMELESS_ROUTES = [
  '/signin',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/suspended',
];

export function isChromeless(pathname: string): boolean {
  return CHROMELESS_ROUTES.includes(pathname);
}

export function fieldMessage({ t, f }: Copy, error: FieldError | undefined): string | undefined {
  if (!error) return undefined;
  return t.auth.fieldErrors[error.code]({ n: f.number(error.n ?? 0) });
}

const LIMITS: Partial<Record<FieldErrorCode, number>> = {
  NAME_TOO_LONG: NAME_MAX_LENGTH,
  PASSWORD_TOO_SHORT: PASSWORD_POLICY.minLength,
  PASSWORD_TOO_LONG: PASSWORD_POLICY.maxLength,
};

// Core's field codes, narrowed to the fields this form shows, with the limit each one names.
export function fieldErrors<F extends string>(
  errors: AuthFieldErrors,
  fields: readonly F[],
): Partial<Record<F, FieldError>> {
  const shown: Partial<Record<F, FieldError>> = {};
  for (const field of fields) {
    const code = errors[field];
    if (code) shown[field] = { code, n: LIMITS[code] };
  }
  return shown;
}

export function formStatus(form: {
  error: AuthProblem | null;
  retryIn: string | null;
  retryReady: boolean;
  isPending: boolean;
}): FormStatus {
  return {
    problem: form.error,
    retryIn: form.retryIn,
    retryReady: form.retryReady,
    isPending: form.isPending,
  };
}

export function passwordCheck(password: string): PasswordCheck {
  const issues = checkPassword(password);
  return {
    strength: passwordStrength(password),
    minLength: PASSWORD_POLICY.minLength,
    longEnough: !issues.includes('TOO_SHORT'),
    notCommon: !issues.includes('COMMON'),
    hasNumberOrSymbol: !needsNumberOrSymbol(password),
  };
}

export function resendState(resend: { isPending: boolean; sent: boolean }): ResendState {
  if (resend.isPending) return 'pending';
  return resend.sent ? 'sent' : 'idle';
}
