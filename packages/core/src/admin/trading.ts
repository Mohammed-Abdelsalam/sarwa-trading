import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

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

// One admin socket per signed-in, visible dashboard; after a reconnect the order lists refetch what was missed.
export function useAdminLive({
  enabled,
  foreground,
}: {
  enabled: boolean;
  foreground: boolean;
}): void {
  const { socket } = useAdmin();
  const queryClient = useQueryClient();
  const connectedBefore = useRef(false);

  useEffect(() => {
    if (!enabled || !foreground) return;
    const stopTrading = socket.onTrading((trading: AdminTrading) => {
      queryClient.setQueryData(adminKeys.trading, trading);
    });
    const stopConnect = socket.onConnect(() => {
      if (connectedBefore.current) {
        void queryClient.invalidateQueries({ queryKey: adminKeys.orderLists });
        void queryClient.invalidateQueries({ queryKey: adminKeys.orderStats });
        void queryClient.invalidateQueries({ queryKey: adminKeys.trading });
      }
      connectedBefore.current = true;
    });
    socket.connect();
    return () => {
      stopTrading();
      stopConnect();
      socket.disconnect();
    };
  }, [enabled, foreground, socket, queryClient]);
}
