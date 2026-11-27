import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { type AdminUser, type LoginRequest } from '@sarwa/contracts';

import { ApiError } from '../api';
import { useCountdown } from '../hooks/time';
import { adminKeys } from './keys';
import { useAdmin } from './provider';

// Mirrors the server throttle: 5 attempts per minute, then a 60 s cooldown.
export const LOGIN_ATTEMPTS = 5;
export const LOGIN_COOLDOWN_MS = 60_000;

export type LoginError = 'invalid' | 'cooldown' | 'unavailable';

export function useAdminSession() {
  const { api } = useAdmin();
  const query = useQuery({
    queryKey: adminKeys.session,
    queryFn: ({ signal }) => api.me({ signal }),
    staleTime: 5 * 60_000,
  });
  const user = query.data ?? null;
  return {
    user,
    isLoading: query.isPending,
    isError: query.isError,
    canEdit: user?.role === 'ADMIN',
    isViewer: user?.role === 'VIEWER',
  };
}

export function useCanEdit(): boolean {
  return useAdminSession().canEdit;
}

export function useLogin({ onSuccess }: { onSuccess?: (user: AdminUser) => void } = {}) {
  const { api } = useAdmin();
  const queryClient = useQueryClient();
  const [failures, setFailures] = useState(0);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const mutation = useMutation({
    mutationFn: (body: LoginRequest) => api.login(body),
    onSuccess: (user) => {
      queryClient.setQueryData(adminKeys.session, user);
      setFailures(0);
      onSuccess?.(user);
    },
  });
  const { reset } = mutation;
  const endCooldown = useCallback(() => {
    setCooldownUntil(null);
    reset();
  }, [reset]);
  const cooldownSeconds = useCountdown(cooldownUntil, endCooldown);

  const startCooldown = () => {
    setFailures(0);
    setCooldownUntil(Date.now() + LOGIN_COOLDOWN_MS);
  };

  const status = mutation.error instanceof ApiError ? mutation.error.status : null;
  const error: LoginError | null =
    cooldownSeconds > 0
      ? 'cooldown'
      : !mutation.isError
        ? null
        : status === 401
          ? 'invalid'
          : status === 429
            ? null
            : 'unavailable';

  return {
    isPending: mutation.isPending,
    error,
    attemptsLeft: LOGIN_ATTEMPTS - failures,
    cooldownSeconds,
    submit: (body: LoginRequest) => {
      if (cooldownSeconds > 0) return;
      mutation.mutate(body, {
        onError: (cause) => {
          const code = cause instanceof ApiError ? cause.status : null;
          if (code === 429 || (code === 401 && failures + 1 >= LOGIN_ATTEMPTS)) startCooldown();
          else if (code === 401) setFailures(failures + 1);
        },
      });
    },
  };
}

export function useLogout() {
  const { api, socket, toLogin } = useAdmin();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => api.logout(),
    onSettled: () => {
      socket.disconnect();
      queryClient.clear();
      toLogin();
    },
  });
  return { logout: () => mutation.mutate(), isPending: mutation.isPending };
}
