import { act, renderHook, waitFor } from '@testing-library/react';

import { ErrorCode } from '@sarwa/contracts';

import {
  useAdminStocks,
  useAdminUsers,
  useAuditLog,
  useCreateStock,
  useCreateUser,
  useDeleteStock,
  useUpdateStock,
  useUpdateUser,
} from '../../src/admin/catalog';
import {
  useAdminConfig,
  useAdminStats,
  useLiveTicker,
  useMarketCommand,
  useServerVersion,
  useUpdateConfig,
} from '../../src/admin/market';
import { isApiError } from '../../src/api';
import { createTestClient, makeProblem, makeStock } from '../utils';
import { createAdminWrapper, makeAdminStock, makeAdminUser, makeConfig } from './fixtures';

describe('market hooks', () => {
  it('loads stats and refreshes them after a market command', async () => {
    const stats = jest.fn(() => Promise.resolve({ connectedClients: 1 }));
    const marketCommand = jest.fn(() =>
      Promise.resolve({ status: { state: 'paused' as const, volatility: 1, since: 1 } }),
    );
    const { Wrapper } = createAdminWrapper({ stats: stats as never, marketCommand });
    const { result } = renderHook(
      () => ({ stats: useAdminStats({ refetchInterval: 10_000 }), command: useMarketCommand() }),
      { wrapper: Wrapper },
    );
    await waitFor(() => {
      expect(result.current.stats.data).toEqual({ connectedClients: 1 });
    });

    await act(() => result.current.command.mutateAsync({ action: 'pause' }));

    expect(marketCommand).toHaveBeenCalledWith({ action: 'pause' });
    await waitFor(() => {
      expect(stats).toHaveBeenCalledTimes(2);
    });
  });

  it('shows the running server build', async () => {
    const { Wrapper } = createAdminWrapper({
      health: () =>
        Promise.resolve({
          status: 'ok' as const,
          uptimeSeconds: 1,
          version: '1.2.0',
          commit: 'abc1234',
        }),
    });
    const { result } = renderHook(() => useServerVersion(), { wrapper: Wrapper });

    expect(result.current).toBeNull();
    await waitFor(() => {
      expect(result.current).toBe('v1.2.0 · abc1234');
    });
  });

  it('reads and saves the app config', async () => {
    const saved = makeConfig({ maintenanceMode: true });
    const { Wrapper } = createAdminWrapper({
      getConfig: () => Promise.resolve(makeConfig()),
      updateConfig: () => Promise.resolve(saved),
    });
    const { result } = renderHook(() => ({ config: useAdminConfig(), save: useUpdateConfig() }), {
      wrapper: Wrapper,
    });
    await waitFor(() => {
      expect(result.current.config.data).toEqual(makeConfig());
    });

    await act(() => result.current.save.mutateAsync({ maintenanceMode: true }));

    await waitFor(() => {
      expect(result.current.config.data).toEqual(saved);
    });
  });

  it('builds ticker rows from the stock list and live quotes', async () => {
    const sarwa = createTestClient({
      listStocks: () =>
        Promise.resolve({
          items: [makeStock('AAPL', {}, { price: 110, prevClose: 100 }), makeStock('TSLA')],
        }),
    });
    const { Wrapper } = createAdminWrapper({}, { sarwa });

    const { result } = renderHook(() => useLiveTicker(['TSLA', 'AAPL', 'NOPE']), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.rows.map((row) => row.symbol)).toEqual(['TSLA', 'AAPL']);
    });
    expect(result.current.rows[1]).toMatchObject({ price: 110, changeBps: 1_000 });
    expect(sarwa.market.acquire).toHaveBeenCalled();
  });
});

describe('catalog hooks', () => {
  it('flips a stock optimistically and rolls back on failure', async () => {
    let fail: (error: unknown) => void = () => undefined;
    const updateStock = jest.fn(
      () =>
        new Promise<never>((_resolve, reject) => {
          fail = reject;
        }),
    );
    const listStocks = jest.fn(() => Promise.resolve({ items: [makeAdminStock()] }));
    const { Wrapper, queryClient } = createAdminWrapper({ listStocks, updateStock });
    const { result } = renderHook(() => ({ list: useAdminStocks(), update: useUpdateStock() }), {
      wrapper: Wrapper,
    });
    await waitFor(() => {
      expect(result.current.list.data).toHaveLength(1);
    });
    const enabled = () =>
      queryClient.getQueryData<{ isEnabled: boolean }[]>(['admin', 'stocks'])?.[0]?.isEnabled;

    const pending = result.current.update.mutateAsync({
      symbol: 'AAPL',
      patch: { isEnabled: false },
    });
    await waitFor(() => {
      expect(enabled()).toBe(false);
    });
    await act(async () => {
      fail(makeProblem(500));
      await pending.catch(() => undefined);
    });

    expect(
      queryClient.getQueryData<{ isEnabled: boolean }[]>(['admin', 'stocks'])?.[0]?.isEnabled,
    ).toBe(true);
  });

  it('creates and deletes stocks and recognises a 409', async () => {
    const createStock = jest.fn(() => Promise.resolve(makeAdminStock()));
    const deleteStock = jest.fn(() => Promise.reject(makeProblem(409)));
    const { Wrapper } = createAdminWrapper({
      createStock,
      deleteStock,
      listStocks: () => Promise.resolve({ items: [] }),
    });
    const { result } = renderHook(() => ({ create: useCreateStock(), remove: useDeleteStock() }), {
      wrapper: Wrapper,
    });

    await act(() =>
      result.current.create.mutateAsync({
        symbol: 'AAPL',
        name: 'Apple',
        sector: 'tech',
        exchange: 'NASDAQ',
        basePrice: 1,
        volatility: 1,
      }),
    );
    const error = await result.current.remove.mutateAsync('AAPL').catch((e: unknown) => e);

    expect(createStock).toHaveBeenCalled();
    expect(isApiError(error, ErrorCode.Conflict)).toBe(true);
    expect(isApiError(new Error('x'), ErrorCode.Conflict)).toBe(false);
  });

  it('skips the users list when not allowed and manages users otherwise', async () => {
    const listUsers = jest.fn(() => Promise.resolve({ items: [makeAdminUser()] }));
    const createUser = jest.fn(() => Promise.resolve(makeAdminUser()));
    const updateUser = jest.fn(() => Promise.resolve(makeAdminUser()));
    const { Wrapper } = createAdminWrapper({ listUsers, createUser, updateUser });

    const view = renderHook(() => useAdminUsers({ enabled: false }), { wrapper: Wrapper });
    expect(view.result.current.fetchStatus).toBe('idle');
    expect(listUsers).not.toHaveBeenCalled();

    const { result } = renderHook(
      () => ({ users: useAdminUsers(), create: useCreateUser(), update: useUpdateUser() }),
      { wrapper: Wrapper },
    );
    await waitFor(() => {
      expect(result.current.users.data).toHaveLength(1);
    });
    await act(() =>
      result.current.create.mutateAsync({
        email: 'sam@minitrading.dev',
        name: 'Sam',
        role: 'VIEWER',
        password: 'password1',
      }),
    );
    await act(() => result.current.update.mutateAsync({ id: 'u1', patch: { status: 'disabled' } }));

    expect(updateUser).toHaveBeenCalledWith('u1', { status: 'disabled' });
  });

  it('pages the audit log with the default page size', async () => {
    const audit = jest.fn(() => Promise.resolve({ items: [], page: 2, pageSize: 25, total: 0 }));
    const { Wrapper } = createAdminWrapper({ audit });

    const { result } = renderHook(() => useAuditLog({ page: 2 }), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.data?.page).toBe(2);
    });
    expect(audit).toHaveBeenCalledWith({ page: 2, pageSize: 25 }, expect.anything());
  });
});
