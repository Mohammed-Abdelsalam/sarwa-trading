import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { type AdminTrading, type CreateHalt, type UpdateTrading } from '@sarwa/contracts';

import { adminKeys } from './keys';
import { useAdmin } from './provider';

export function useAdminTrading() {
  const { api } = useAdmin();
  return useQuery({
    queryKey: adminKeys.trading,
    queryFn: ({ signal }) => api.trading({ signal }),
  });
}

export function useUpdateTrading() {
  const { api } = useAdmin();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdateTrading) => api.updateTrading(patch),
    onSuccess: (trading) => {
      queryClient.setQueryData(adminKeys.trading, trading);
    },
  });
}

export function useHaltImpact(symbol: string | null) {
  const { api } = useAdmin();
  return useQuery({
    queryKey: adminKeys.haltImpact(symbol ?? ''),
    queryFn: ({ signal }) => api.haltImpact(symbol ?? '', { signal }),
    enabled: Boolean(symbol),
  });
}

export function useCreateHalt() {
  const { api } = useAdmin();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateHalt) => api.createHalt(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.trading }),
  });
}

export function useResumeHalt() {
  const { api } = useAdmin();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (symbol: string) => api.resumeHalt(symbol),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.trading }),
  });
}

// One admin socket per signed-in dashboard; trading changes made elsewhere land in the cache.
export function useAdminLive(enabled: boolean): void {
  const { socket } = useAdmin();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    const stop = socket.onTrading((trading: AdminTrading) => {
      queryClient.setQueryData(adminKeys.trading, trading);
    });
    socket.connect();
    return () => {
      stop();
      socket.disconnect();
    };
  }, [enabled, socket, queryClient]);
}
