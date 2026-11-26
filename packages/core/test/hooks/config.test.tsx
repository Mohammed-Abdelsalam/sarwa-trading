import { act, renderHook, waitFor } from '@testing-library/react';

import { type AppConfig, PERIODS } from '@sarwa/contracts';

import {
  queryKeys,
  useAppConfig,
  useAppNotices,
  useEnabledPeriods,
  useRefreshAppConfig,
} from '../../src/hooks';
import { createTestClient, createWrapper } from '../utils';

const config = (overrides: Partial<AppConfig> = {}): AppConfig => ({
  maintenanceMode: false,
  banner: null,
  enabledPeriods: [...PERIODS],
  updatedAt: 1,
  ...overrides,
});

describe('useAppConfig', () => {
  it('returns the REST config when nothing came over the socket', async () => {
    const rest = config({ updatedAt: 5 });
    const { Wrapper } = createWrapper(
      createTestClient({ getAppConfig: () => Promise.resolve(rest) }),
    );

    const { result } = renderHook(() => useAppConfig(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current).toEqual(rest);
    });
  });

  it('returns the live config while REST has not answered', () => {
    const client = createTestClient({ getAppConfig: () => new Promise(() => undefined) });
    const live = config({ maintenanceMode: true });
    client.store.getState().setAppConfig(live);
    const { Wrapper } = createWrapper(client);

    const { result } = renderHook(() => useAppConfig(), { wrapper: Wrapper });

    expect(result.current).toEqual(live);
  });

  it('prefers whichever config is newer', async () => {
    const rest = config({ updatedAt: 10, maintenanceMode: false });
    const client = createTestClient({ getAppConfig: () => Promise.resolve(rest) });
    client.store.getState().setAppConfig(config({ updatedAt: 5, maintenanceMode: true }));
    const { Wrapper } = createWrapper(client);
    const { result } = renderHook(() => useAppConfig(), { wrapper: Wrapper });
    await waitFor(() => {
      expect(result.current).toEqual(rest);
    });

    const newer = config({ updatedAt: 20, maintenanceMode: true });
    act(() => {
      client.store.getState().setAppConfig(newer);
    });

    expect(result.current).toEqual(newer);
  });
});

describe('useEnabledPeriods', () => {
  it('falls back to every period and follows the admin config once loaded', async () => {
    const { Wrapper } = createWrapper(
      createTestClient({
        getAppConfig: () => Promise.resolve(config({ enabledPeriods: ['1D', '1W'] })),
      }),
    );

    const { result } = renderHook(() => useEnabledPeriods(), { wrapper: Wrapper });
    expect(result.current).toEqual(PERIODS);

    await waitFor(() => {
      expect(result.current).toEqual(['1D', '1W']);
    });
  });
});

describe('useAppNotices', () => {
  it('hides a dismissed banner and shows the next new message again', async () => {
    const client = createTestClient({
      getAppConfig: () =>
        Promise.resolve(config({ banner: { message: 'Early close', tone: 'info' } })),
    });
    client.store.getState().setConnection({ status: 'open' });
    const { Wrapper } = createWrapper(client);
    const { result } = renderHook(() => useAppNotices(), { wrapper: Wrapper });
    await waitFor(() => {
      expect(result.current.notices).toHaveLength(1);
    });

    act(() => {
      const [remote] = result.current.notices;
      if (remote) result.current.dismiss(remote);
    });
    expect(result.current.notices).toEqual([]);

    act(() => {
      client.store
        .getState()
        .setAppConfig(config({ updatedAt: 2, banner: { message: 'Holiday', tone: 'warning' } }));
    });
    expect(result.current.notices.map((n) => n.message)).toEqual(['Holiday']);
  });
});

describe('useRefreshAppConfig', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('invalidates the config on the interval and stops on unmount', () => {
    jest.useFakeTimers();
    const { Wrapper, queryClient } = createWrapper(createTestClient());
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    const { unmount } = renderHook(() => useRefreshAppConfig({ every: 30_000 }), {
      wrapper: Wrapper,
    });

    act(() => {
      jest.advanceTimersByTime(30_000);
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.appConfig });

    unmount();
    act(() => {
      jest.advanceTimersByTime(60_000);
    });
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it('refreshes on demand without an interval', () => {
    const { Wrapper, queryClient } = createWrapper(createTestClient());
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useRefreshAppConfig(), { wrapper: Wrapper });

    result.current();

    expect(invalidate).toHaveBeenCalledTimes(1);
  });
});
