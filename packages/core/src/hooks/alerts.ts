import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useState } from 'react';

import {
  type Alert,
  type AlertsResponse,
  type CreateAlertRequest,
  type UpdateAlertRequest,
} from '@sarwa/contracts';
import { type AlertIssue, bps, ticks, validateAlert } from '@sarwa/domain';

import { ApiError } from '../api';
import { useSarwa } from '../provider';
import { toTradeQuote } from '../trading';
import { queryKeys } from './keys';

export function useAlerts(): UseQueryResult<AlertsResponse> {
  const { api } = useSarwa();
  return useQuery({
    queryKey: queryKeys.alerts,
    queryFn: ({ signal }) => api.listAlerts({ signal }),
    staleTime: 30_000,
  });
}

function replaceAlert(current: AlertsResponse | undefined, alert: Alert) {
  return current
    ? { ...current, items: current.items.map((item) => (item.id === alert.id ? alert : item)) }
    : current;
}

// An alert that is already true is caught here against the live quote, before any request.
export function useCreateAlert() {
  const { api, store, analytics } = useSarwa();
  const queryClient = useQueryClient();
  const [issue, setIssue] = useState<AlertIssue | null>(null);

  const mutation = useMutation({
    mutationFn: (request: CreateAlertRequest) => api.createAlert(request),
    onSuccess: (alert) => {
      queryClient.setQueryData<AlertsResponse>(queryKeys.alerts, (current) =>
        current
          ? { ...current, items: [alert, ...current.items], activeCount: current.activeCount + 1 }
          : current,
      );
      analytics.track({ name: 'alert_created', condition: alert.condition, repeat: alert.repeat });
      return queryClient.invalidateQueries({ queryKey: queryKeys.alerts });
    },
  });

  return {
    status: mutation.status,
    alert: mutation.data ?? null,
    issue,
    errorCode: mutation.error instanceof ApiError ? mutation.error.problem.code : null,
    error: mutation.error,
    create: (request: CreateAlertRequest): AlertIssue | null => {
      const quote = store.getState().quotes[request.symbol];
      const found = quote
        ? validateAlert(
            {
              condition: request.condition,
              thresholdTicks:
                request.thresholdTicks === undefined ? null : ticks(request.thresholdTicks),
              thresholdBps: request.thresholdBps === undefined ? null : bps(request.thresholdBps),
            },
            toTradeQuote(quote),
          )
        : null;
      setIssue(found);
      if (!found) mutation.mutate(request);
      return found;
    },
    reset: () => {
      setIssue(null);
      mutation.reset();
    },
  };
}

export function useUpdateAlert() {
  const { api } = useSarwa();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateAlertRequest }) =>
      api.updateAlert(id, patch),
    onSuccess: (alert) => {
      queryClient.setQueryData<AlertsResponse>(queryKeys.alerts, (current) =>
        replaceAlert(current, alert),
      );
    },
  });
}

export function useDeleteAlert() {
  const { api } = useSarwa();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteAlert(id),
    onSuccess: (_result, id) => {
      queryClient.setQueryData<AlertsResponse>(queryKeys.alerts, (current) =>
        current ? { ...current, items: current.items.filter((item) => item.id !== id) } : current,
      );
      return queryClient.invalidateQueries({ queryKey: queryKeys.alerts });
    },
  });
}
