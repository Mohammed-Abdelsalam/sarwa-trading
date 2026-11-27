import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { z } from 'zod';

import {
  AccountSuspendedProblemSchema,
  AUTH_LIMITS,
  ChangePasswordRequestSchema,
  DeleteAccountRequestSchema,
  ForgotPasswordRequestSchema,
  type GuestDataCounts,
  GuestDataPresentProblemSchema,
  RateLimitedProblemSchema,
  ResendVerificationRequestSchema,
  ResetPasswordRequestSchema,
  SelfResetRequestSchema,
  type SignInRequest,
  SignInRequestSchema,
  SignUpRequestSchema,
  TokenExpiredProblemSchema,
  UpdateProfileRequestSchema,
} from '@sarwa/contracts';
import { AUTH_FIELD_ERRORS, type AuthFieldError } from '@sarwa/domain';
import { getMessages } from '@sarwa/i18n';

import { ApiError, problemDetails } from '../api';
import { endSession, startSession } from '../auth/session';
import { useSarwa } from '../provider';
import { useI18n } from './i18n';
import { usePrivateScope, useClientAuth } from './session';
import { useCountdown } from './time';

// A banner from t.auth.errors; RATE_LIMITED takes the retryIn time.
export type AuthErrorCode = keyof ReturnType<typeof getMessages>['auth']['errors'];
// Field name to a code from t.auth.fieldErrors.
export type AuthFieldErrors = Partial<Record<string, AuthFieldError>>;

const BANNERS = new Set<string>(Object.keys(getMessages('en').auth.errors));
const FIELD_ERRORS = new Set<string>(AUTH_FIELD_ERRORS);

function isFieldError(code: string | undefined): code is AuthFieldError {
  return code !== undefined && FIELD_ERRORS.has(code);
}

function fieldErrors(entries: [string, string | undefined][]): AuthFieldErrors {
  const fields: AuthFieldErrors = {};
  for (const [field, code] of entries) if (isFieldError(code)) fields[field] ??= code;
  return fields;
}

// What a failed auth request shows: a banner, codes under the fields, or both.
export function authFailure(error: unknown): {
  code: AuthErrorCode | null;
  fields: AuthFieldErrors;
} {
  if (!(error instanceof ApiError)) return { code: 'OFFLINE', fields: {} };
  const fields = fieldErrors(
    Object.entries(error.problem.errors ?? {}).map(([field, codes]) => [field, codes[0]]),
  );
  const code = error.problem.code;
  if (BANNERS.has(code)) return { code: code as AuthErrorCode, fields };
  return { code: Object.keys(fields).length > 0 ? null : 'UNKNOWN', fields };
}

// "0:42" for the rate-limit and resend countdowns.
export function clockText(seconds: number): string {
  return `${String(Math.floor(seconds / 60))}:${String(seconds % 60).padStart(2, '0')}`;
}

// A wait the form shows as m:ss in the reader's digits; null once it is over.
export function useCooldown() {
  const { f } = useI18n();
  const [until, setUntil] = useState<number | null>(null);
  const end = useCallback(() => {
    setUntil(null);
  }, []);
  const seconds = useCountdown(until, end);
  return {
    seconds,
    time: seconds > 0 ? f.localDigits(clockText(seconds)) : null,
    start: (ms: number) => {
      setUntil(Date.now() + ms);
    },
  };
}

interface AuthFormOptions<Input, Body, Result> {
  check?: (input: Input) => AuthFieldErrors;
  onSuccess?: (result: Result, body: Body) => unknown;
  onError?: (error: unknown, body: Body) => void;
}

// One auth form: checked against the shared schema before sending, then the server's answer as a
// banner code, field codes and, when rate limited, a countdown.
function useAuthForm<S extends z.ZodType, Result>(
  schema: S,
  send: (body: z.output<S>) => Promise<Result>,
  { check, onSuccess, onError }: AuthFormOptions<z.input<S>, z.output<S>, Result> = {},
) {
  const [invalid, setInvalid] = useState<AuthFieldErrors>({});
  const wait = useCooldown();
  const mutation = useMutation({
    mutationFn: send,
    onSuccess: (result, body) => onSuccess?.(result, body),
    onError: (error, body) => {
      const limited = problemDetails(error, RateLimitedProblemSchema);
      if (limited) wait.start(limited.retryAfterSeconds * 1_000);
      onError?.(error, body);
    },
  });
  const failure = mutation.error ? authFailure(mutation.error) : null;
  const limited = failure?.code === 'RATE_LIMITED';

  return {
    submit: (input: z.input<S>) => {
      if (wait.seconds > 0 || mutation.isPending) return;
      const parsed = schema.safeParse(input);
      const fields = {
        ...(parsed.success
          ? {}
          : fieldErrors(parsed.error.issues.map((i) => [String(i.path[0]), i.message]))),
        ...check?.(input),
      };
      setInvalid(fields);
      if (parsed.success && Object.keys(fields).length === 0) mutation.mutate(parsed.data);
    },
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    data: mutation.data ?? null,
    error: limited && wait.seconds === 0 ? null : (failure?.code ?? null),
    fieldErrors: { ...failure?.fields, ...invalid },
    retryIn: wait.time,
    // The polite "You can try again now" once a rate limit has passed.
    retryReady: limited && wait.seconds === 0,
    canSubmit: wait.seconds === 0 && !mutation.isPending,
    reset: () => {
      setInvalid({});
      mutation.reset();
    },
  };
}

export function useSignUp() {
  const auth = useClientAuth();
  const { api } = useSarwa();
  return useAuthForm(SignUpRequestSchema, (body) => api.signUp(body), {
    onSuccess: (session) => startSession(auth, session),
  });
}

interface DiscardPrompt {
  counts: GuestDataCounts;
  body: SignInRequest;
}

// A 409 GUEST_DATA_PRESENT asks before this device's guest portfolio is replaced: confirm resends
// with the ticket, cancel keeps the guest state.
export function useSignIn() {
  const auth = useClientAuth();
  const { api } = useSarwa();
  const [prompt, setPrompt] = useState<DiscardPrompt | null>(null);
  const form = useAuthForm(SignInRequestSchema, (body) => api.signIn(body), {
    onSuccess: (session) => startSession(auth, session),
    onError: (error, body) => {
      const guest = problemDetails(error, GuestDataPresentProblemSchema);
      if (guest) {
        const { positions, openOrders, watchlist, ticket } = guest;
        setPrompt({
          counts: { positions, openOrders, watchlist },
          body: { ...body, guestTicket: ticket },
        });
      }
      const suspended = problemDetails(error, AccountSuspendedProblemSchema);
      if (suspended) void endSession(auth, 'suspended', suspended.suspension);
    },
  });
  return {
    ...form,
    error: prompt ? null : form.error,
    needsDiscard: prompt !== null,
    counts: prompt?.counts ?? null,
    confirm: () => {
      if (!prompt) return;
      setPrompt(null);
      form.submit(prompt.body);
    },
    cancel: () => {
      setPrompt(null);
      form.reset();
    },
  };
}

export function useSignOut() {
  const auth = useClientAuth();
  const { api } = useSarwa();
  const mutation = useMutation({
    mutationFn: () => api.signOut(),
    // Signed out locally even when the server can't be reached.
    onSettled: () => endSession(auth),
  });
  return {
    signOut: () => {
      mutation.mutate();
    },
    isPending: mutation.isPending,
  };
}

// The sent state never says whether the email exists; resending waits a minute.
export function useForgotPassword() {
  const { api } = useSarwa();
  const resend = useCooldown();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const form = useAuthForm(ForgotPasswordRequestSchema, (body) => api.forgotPassword(body), {
    onSuccess: (_result, body) => {
      setSentTo(body.email);
      resend.start(AUTH_LIMITS.resendCooldownMs);
    },
  });
  return {
    ...form,
    sentTo,
    resendIn: resend.time,
    resend: () => {
      if (sentTo && resend.seconds === 0) form.submit({ email: sentTo });
    },
  };
}

export type LinkState = 'checking' | 'ready' | 'expired' | 'failed';

function linkState(query: { isPending: boolean; isError: boolean; error: unknown }): LinkState {
  if (query.isPending) return 'checking';
  if (!query.isError) return 'ready';
  return problemDetails(query.error, TokenExpiredProblemSchema) ? 'expired' : 'failed';
}

// The reset page: which account the link is for, then the new password (typed twice).
export function useResetPassword(token: string) {
  const auth = useClientAuth();
  const { api } = useSarwa();
  const info = useQuery({
    queryKey: ['auth', 'reset', token],
    queryFn: ({ signal }) => api.getResetInfo(token, { signal }),
    retry: false,
    staleTime: Infinity,
  });
  const form = useAuthForm(
    ResetPasswordRequestSchema.extend({ confirm: z.string().optional() }),
    ({ confirm: _confirm, ...body }) => api.resetPassword(body),
    {
      check: ({ password, confirm }) =>
        confirm !== undefined && confirm !== password ? { confirm: 'PASSWORDS_DIFFER' } : {},
      onSuccess: (session) => startSession(auth, session),
    },
  );
  return {
    ...form,
    link: linkState(info),
    email: info.data?.email ?? null,
    sessionsRevoked: form.data?.sessionsRevoked ?? null,
    submit: ({
      password,
      confirm,
      keepSignedIn,
      deviceModel,
    }: Record<'password' | 'confirm', string> & {
      keepSignedIn?: boolean;
      deviceModel?: string;
    }) => {
      form.submit({ token, password, confirm, keepSignedIn, deviceModel });
    },
  };
}

// The emailed link is spent once, so it is checked as a query: remounts never send it twice.
export function useVerifyEmail(token: string) {
  const { api, auth } = useSarwa();
  const query = useQuery({
    queryKey: ['auth', 'verify', token],
    queryFn: async () => {
      const result = await api.verifyEmail({ token });
      const session = auth?.session.getState();
      if (session?.user) session.update({ ...session.user, emailVerified: true });
      return result;
    },
    retry: false,
    staleTime: Infinity,
  });
  return {
    state: linkState(query),
    // Who the link was for: the verified address, or the one an expired link names.
    email:
      query.data?.email ?? problemDetails(query.error, TokenExpiredProblemSchema)?.email ?? null,
  };
}

// Signed in it resends to the session's email; from an expired link, to the address it named.
export function useResendVerification() {
  const { api } = useSarwa();
  const cooldown = useCooldown();
  const form = useAuthForm(
    ResendVerificationRequestSchema,
    (body) => api.resendVerification(body),
    {
      onSuccess: () => {
        cooldown.start(AUTH_LIMITS.resendCooldownMs);
      },
    },
  );
  return {
    resend: (email?: string) => {
      if (cooldown.seconds === 0) form.submit(email ? { email } : {});
    },
    isPending: form.isPending,
    sent: form.isSuccess,
    error: form.error,
    resendIn: cooldown.time ?? form.retryIn,
    canResend: cooldown.seconds === 0 && form.canSubmit,
  };
}

// Called once a settings form is saved, e.g. for the app's toast.
export interface SavedOptions {
  onSuccess?: () => void;
}

export function useChangePassword({ onSuccess }: SavedOptions = {}) {
  const { api } = useSarwa();
  const queryClient = useQueryClient();
  const { keys } = usePrivateScope();
  const form = useAuthForm(
    ChangePasswordRequestSchema.extend({ confirm: z.string().optional() }),
    ({ confirm: _confirm, ...body }) => api.changePassword(body),
    {
      check: ({ next, confirm }) =>
        confirm !== undefined && confirm !== next ? { confirm: 'PASSWORDS_DIFFER' } : {},
      onSuccess: () => {
        onSuccess?.();
        return queryClient.invalidateQueries({ queryKey: keys.sessions });
      },
    },
  );
  return { ...form, sessionsRevoked: form.data?.sessionsRevoked ?? null };
}

export function useUpdateProfile({ onSuccess }: SavedOptions = {}) {
  const auth = useClientAuth();
  const { api } = useSarwa();
  return useAuthForm(UpdateProfileRequestSchema, (body) => api.updateProfile(body), {
    onSuccess: (user) => {
      auth.session.getState().update(user);
      onSuccess?.();
    },
  });
}

export function useSessions() {
  const { api } = useSarwa();
  const { keys, enabled } = usePrivateScope();
  const query = useQuery({
    queryKey: keys.sessions,
    queryFn: ({ signal }) => api.listSessions({ signal }),
    enabled,
    staleTime: 30_000,
  });
  const items = query.data?.items ?? [];
  return {
    current: items.find((session) => session.current) ?? null,
    others: items.filter((session) => !session.current),
    isLoading: enabled && query.isPending,
    isError: query.isError && !query.data,
    retry: () => void query.refetch(),
  };
}

export function useRevokeSession() {
  const { api } = useSarwa();
  const queryClient = useQueryClient();
  const { keys } = usePrivateScope();
  return useMutation({
    mutationFn: (id: string) => api.revokeSession(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.sessions }),
  });
}

export function useSignOutOthers() {
  const { api } = useSarwa();
  const queryClient = useQueryClient();
  const { keys } = usePrivateScope();
  return useMutation({
    mutationFn: () => api.signOutOthers(),
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.sessions }),
  });
}

// What the delete-account dialog spells out.
export function useMeSummary() {
  const { api } = useSarwa();
  const { keys, enabled } = usePrivateScope();
  return useQuery({
    queryKey: keys.summary,
    queryFn: ({ signal }) => api.getMeSummary({ signal }),
    enabled,
  });
}

// The server ends every session; this one signs out here and the app shows the purge date.
export function useDeleteAccount() {
  const auth = useClientAuth();
  const { api } = useSarwa();
  const form = useAuthForm(DeleteAccountRequestSchema, (body) => api.deleteAccount(body), {
    onSuccess: () => endSession(auth),
  });
  return { ...form, purgeAt: form.data?.purgeAt ?? null };
}

// A fresh $100,000 practice account: every personal query refetches.
export function useSelfReset() {
  const { api } = useSarwa();
  const queryClient = useQueryClient();
  const { keys } = usePrivateScope();
  return useAuthForm(SelfResetRequestSchema, (body) => api.selfReset(body), {
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.root }),
  });
}
