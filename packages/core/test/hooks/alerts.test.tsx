import { act, renderHook, waitFor } from '@testing-library/react';

import { type AlertsResponse } from '@sarwa/contracts';

import { ApiError } from '../../src/api';
import {
  queryKeys,
  useAlerts,
  useCreateAlert,
  useDeleteAlert,
  useUpdateAlert,
} from '../../src/hooks';
import { makeAlert } from '../trading-fixtures';
import { createTestClient, createWrapper, makeQuote } from '../utils';

const LIST: AlertsResponse = { items: [makeAlert()], activeCount: 1, limit: 50 };

function setup(api: Parameters<typeof createTestClient>[0] = {}) {
  const client = createTestClient({ listAlerts: () => Promise.resolve(LIST), ...api });
  client.store.getState().applyQuotes([makeQuote({ price: 231.48 })]);
  const { Wrapper, queryClient } = createWrapper(client);
  queryClient.setQueryData(queryKeys.alerts, LIST);
  return { client, queryClient, Wrapper };
}

describe('useCreateAlert', () => {
  it('surfaces an alert that is already true without sending it', () => {
    const createAlert = jest.fn();
    const { Wrapper } = setup({ createAlert });
    const { result } = renderHook(() => useCreateAlert(), { wrapper: Wrapper });

    act(() => {
      result.current.create({
        symbol: 'AAPL',
        condition: 'price_above',
        thresholdTicks: 2_000_000,
        repeat: 'once',
      });
    });

    expect(result.current.issue).toEqual({ code: 'ALREADY_ABOVE', lastTicks: 2_314_800 });
    expect(createAlert).not.toHaveBeenCalled();
  });

  it('creates a valid alert, adds it to the list and tracks it', async () => {
    const created = makeAlert({ id: 'al-2', thresholdTicks: 2_600_000 });
    let saved = LIST;
    const { client, queryClient, Wrapper } = setup({
      listAlerts: () => Promise.resolve(saved),
      createAlert: () => {
        saved = { ...LIST, items: [created, ...LIST.items] };
        return Promise.resolve(created);
      },
    });
    const { result } = renderHook(() => ({ create: useCreateAlert(), list: useAlerts() }), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.create.create({
        symbol: 'AAPL',
        condition: 'price_above',
        thresholdTicks: 2_600_000,
        repeat: 'once',
      });
    });

    await waitFor(() => {
      expect(result.current.create.status).toBe('success');
    });
    expect(queryClient.getQueryData<AlertsResponse>(queryKeys.alerts)?.items[0]).toEqual(created);
    expect(result.current.create.issue).toBeNull();
    expect(client.analytics.track).toHaveBeenCalledWith({
      name: 'alert_created',
      condition: 'price_above',
      repeat: 'once',
    });
  });

  it('exposes the server error code when the server refuses the alert', async () => {
    const { Wrapper } = setup({
      createAlert: () =>
        Promise.reject(
          new ApiError({ type: 'about:blank', title: 'Limit', status: 409, code: 'CONFLICT' }),
        ),
    });
    const { result } = renderHook(() => useCreateAlert(), { wrapper: Wrapper });

    act(() => {
      result.current.create({
        symbol: 'AAPL',
        condition: 'move_today',
        thresholdBps: 500,
        repeat: 'every',
      });
    });

    await waitFor(() => {
      expect(result.current.errorCode).toBe('CONFLICT');
    });
    act(() => {
      result.current.reset();
    });
    await waitFor(() => {
      expect(result.current.errorCode).toBeNull();
    });
  });
});

describe('useUpdateAlert and useDeleteAlert', () => {
  it('replace and remove alerts in the cached list', async () => {
    const { queryClient, Wrapper } = setup({
      updateAlert: () => Promise.resolve(makeAlert({ enabled: false })),
      deleteAlert: () => Promise.resolve(),
    });
    const { result } = renderHook(() => ({ update: useUpdateAlert(), remove: useDeleteAlert() }), {
      wrapper: Wrapper,
    });
    const items = () => queryClient.getQueryData<AlertsResponse>(queryKeys.alerts)?.items;

    act(() => {
      result.current.update.mutate({ id: 'al-1', patch: { enabled: false } });
    });
    await waitFor(() => {
      expect(items()?.[0]?.enabled).toBe(false);
    });

    act(() => {
      result.current.remove.mutate('al-1');
    });
    await waitFor(() => {
      expect(result.current.remove.isSuccess).toBe(true);
    });
  });
});
