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
import { useRequireAuth } from './gate';
import { useLiveSymbols, useQuote } from './live';
import { usePrivateScope } from './session';

export function useAlerts(): UseQueryResult<AlertsResponse> {
  const { api } = useSarwa();
  const { keys, enabled } = usePrivateScope();
  return useQuery({
    queryKey: keys.alerts,
    queryFn: ({ signal }) => api.listAlerts({ signal }),
    staleTime: 30_000,
    enabled,
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
  const { keys } = usePrivateScope();
  const { run } = useRequireAuth();
  const [issue, setIssue] = useState<AlertIssue | null>(null);

  const mutation = useMutation({
    mutationFn: (request: CreateAlertRequest) => api.createAlert(request),
    onSuccess: (alert) => {
      queryClient.setQueryData<AlertsResponse>(keys.alerts, (current) =>
        current
          ? { ...current, items: [alert, ...current.items], activeCount: current.activeCount + 1 }
          : current,
      );
      analytics.track({ name: 'alert_created', condition: alert.condition, repeat: alert.repeat });
      return queryClient.invalidateQueries({ queryKey: keys.alerts });
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
      if (!found) {
        run({ kind: 'alert', symbol: request.symbol }, () => {
          mutation.mutate(request);
        });
      }
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
  const { keys } = usePrivateScope();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateAlertRequest }) =>
      api.updateAlert(id, patch),
    onSuccess: (alert) => {
      queryClient.setQueryData<AlertsResponse>(keys.alerts, (current) =>
        replaceAlert(current, alert),
      );
    },
  });
}

export function useDeleteAlert() {
  const { api } = useSarwa();
  const queryClient = useQueryClient();
  const { keys } = usePrivateScope();
  return useMutation({
    mutationFn: (id: string) => api.deleteAlert(id),
    onSuccess: (_result, id) => {
      queryClient.setQueryData<AlertsResponse>(keys.alerts, (current) =>
        current ? { ...current, items: current.items.filter((item) => item.id !== id) } : current,
      );
      return queryClient.invalidateQueries({ queryKey: keys.alerts });
    },
  });
}

// The create-alert form both apps show: typed text in, a request (or null) and the live quote out.
// `initial` restores what a guest's alert intent saved.
export function useAlertForm(
  symbol: string,
  initial: { condition?: Alert['condition']; target?: string } = {},
) {
  const create = useCreateAlert();
  const { run } = useRequireAuth();
  const limit = useAlerts().data?.limit ?? null;
  useLiveSymbols(symbol ? [symbol] : []);
  const quote = useQuote(symbol);
  const [condition, setCondition] = useState<Alert['condition']>(
    initial.condition ?? 'price_above',
  );
  const [target, setTarget] = useState(initial.target ?? '');
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
    // False when the target isn't a usable number, so nothing was sent. A guest keeps the form
    // for after sign-in.
    submit: (): boolean => {
      if (!request) return false;
      run({ kind: 'alert', symbol, condition, target }, () => {
        create.create(request);
      });
      return true;
    },
  };
}
