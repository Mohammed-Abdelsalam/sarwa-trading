import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useState } from 'react';

import {
  type Alert,
  type AlertsResponse,
  type CreateAlertRequest,
  ErrorCode,
  type UpdateAlertRequest,
} from '@sarwa/contracts';
import { type AlertIssue, bps, ticks, validateAlert } from '@sarwa/domain';

import { alertRequest } from '../alerts';
import { ApiError, isApiError } from '../api';
import { useSarwa } from '../provider';
import { toTradeQuote } from '../trading';
import { queryKeys } from './keys';
import { useLiveSymbols, useQuote } from './live';

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

// The create-alert form both apps show: typed text in, a request (or null) and the live quote out.
export function useAlertForm(symbol: string) {
  const create = useCreateAlert();
  const limit = useAlerts().data?.limit ?? null;
  useLiveSymbols(symbol ? [symbol] : []);
  const quote = useQuote(symbol);
  const [condition, setCondition] = useState<Alert['condition']>('price_above');
  const [target, setTarget] = useState('');
  const [repeat, setRepeat] = useState<Alert['repeat']>('once');
  const request = alertRequest({ symbol, condition, target, repeat });

  return {
    condition,
    target,
    repeat,
    request,
    quote,
    status: create.status,
    issue: create.issue,
    failed: create.error !== null,
    limitReached: isApiError(create.error, ErrorCode.AlertLimit) ? limit : null,
    setCondition: (next: Alert['condition']) => {
      create.reset();
      setCondition(next);
    },
    setTarget: (next: string) => {
      create.reset();
      setTarget(next);
    },
    setRepeat,
    reset: create.reset,
    // False when the target isn't a usable number, so nothing was sent.
    submit: (): boolean => {
      if (!request) return false;
      create.create(request);
      return true;
    },
  };
}
