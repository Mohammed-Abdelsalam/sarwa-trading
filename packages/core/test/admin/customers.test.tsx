import { act, renderHook, waitFor } from '@testing-library/react';

import { type CustomerRow, ErrorCode } from '@sarwa/contracts';

import { createAdminApi } from '../../src/admin/api';
import {
  customerFiltersFromParams,
  customerFiltersToParams,
  customerPositionRow,
  customersQuery,
  useAcceptInvite,
  useCreateInvite,
  useCustomer,
  useCustomerActivity,
  useCustomerKpis,
  useCustomerOrders,
  useCustomers,
  useExportCustomers,
  useCustomerSessions,
  useInviteInfo,
  useInvites,
  useReactivateCustomer,
  useResetCustomerAccount,
  useRevealCustomer,
  useResendInvite,
  useRevokeInvite,
  useSendCustomerReset,
  useSignOutCustomer,
  useSuspendCustomer,
} from '../../src/admin/customers';
import { adminKeys } from '../../src/admin/keys';
import { isApiError } from '../../src/api';
import { makeOrder } from '../trading-fixtures';
import { makeProblem } from '../utils';
import { createAdminWrapper, makeAdminUser } from './fixtures';

const HANDLE = 'ACC-7F2A9C';

function makeRow(overrides: Partial<CustomerRow> = {}): CustomerRow {
  return {
    id: 'u1',
    handle: HANDLE,
    name: 'Sara Ali',
    email: 's•••@example.com',
    status: 'active',
    emailVerified: true,
    signupPlatform: 'web',
    equityCents: 10_000_000,
    allTimeCents: 0,
    allTimeBps: 0,
    openOrders: 0,
    lastActiveAt: null,
    createdAt: 1,
    deletionRequestedAt: null,
    ...overrides,
  };
}

const ACTION = { customer: makeRow({ status: 'suspended' }), sessionsRevoked: 2 };
const INVITE = {
  id: 'inv-1',
  email: 'sam@minitrading.dev',
  role: 'VIEWER' as const,
  invitedBy: 'maya@minitrading.dev',
  status: 'pending' as const,
  createdAt: '2026-11-27T10:00:00.000Z',
  expiresAt: '2026-11-29T10:00:00.000Z',
};

describe('customer filters in the URL', () => {
  it('round-trips through search params, leaving defaults out', () => {
    const params = new URLSearchParams('q=%20sara%20&status=suspended&verified=1&open=1');
    const filters = customerFiltersFromParams((key) => params.get(key));

    expect(filters).toEqual({
      q: 'sara',
      status: 'suspended',
      verified: true,
      hasOpenOrders: true,
    });
    expect(customerFiltersToParams(filters)).toEqual({
      q: 'sara',
      status: 'suspended',
      verified: '1',
      open: '1',
    });
    const clean = customerFiltersFromParams(() => null);
    expect(clean).toEqual({ q: '', status: 'all', verified: false, hasOpenOrders: false });
    expect(customerFiltersToParams(clean)).toEqual({
      q: null,
      status: null,
      verified: null,
      open: null,
    });
    expect(customerFiltersFromParams((key) => (key === 'status' ? 'nope' : null)).status).toBe(
      'all',
    );
  });

  it('builds the API query and the CSV link from the same filters', () => {
    const query = customersQuery({
      q: 'sara',
      status: 'active',
      verified: true,
      hasOpenOrders: false,
    });
    expect(query).toEqual({
      q: 'sara',
      status: 'active',
      verified: true,
      hasOpenOrders: undefined,
      limit: 50,
    });
  });

  it('maps a position to its average cost and return', () => {
    expect(
      customerPositionRow({
        symbol: 'AAPL',
        qtyMicros: 10_000_000,
        costBasisCents: 200_000,
        marketValueCents: 231_480,
      }),
    ).toMatchObject({ avgCostTicks: 2_000_000, returnCents: 31_480, returnBps: 1_574 });
  });
});

describe('customer and invite endpoints', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('call the admin routes with the right method and body', async () => {
    const calls: string[] = [];
    const bodies: Record<string, unknown> = {
      'GET /api/v1/admin/customers?status=all&limit=50': { items: [], nextCursor: null, total: 0 },
      'GET /api/v1/admin/customers/ACC-7F2A9C/orders?cursor=c1': { items: [], nextCursor: null },
      'GET /api/v1/admin/customers/ACC-7F2A9C/sessions': { items: [] },
      'GET /api/v1/admin/customers/ACC-7F2A9C/activity': { items: [], nextCursor: null },
      'POST /api/v1/admin/customers/ACC-7F2A9C/reveal': { items: [] },
      'GET /api/v1/admin/invites': { items: [INVITE] },
      'POST /api/v1/admin/invites': { invite: INVITE },
      'POST /api/v1/admin/invites/inv-1/resend': { invite: INVITE },
      'GET /api/v1/admin/invites/token/tok': {
        email: INVITE.email,
        role: 'VIEWER',
        expiresAt: INVITE.expiresAt,
      },
      'POST /api/v1/admin/invites/accept': { user: makeAdminUser() },
    };
    global.fetch = jest.fn((url: string, init: RequestInit) => {
      const call = `${init.method ?? 'GET'} ${url}`;
      calls.push(init.body ? `${call} ${init.body as string}` : call);
      const body = bodies[call] ?? (call.startsWith('POST') ? ACTION : undefined);
      return Promise.resolve({
        ok: true,
        status: body === undefined ? 204 : 200,
        json: () => Promise.resolve(body),
        text: () => Promise.resolve('csv'),
      });
    }) as unknown as typeof fetch;
    const api = createAdminApi();
    const reason = { reason: 'Customer asked for it' };

    await api.customers({ status: 'all', limit: 50 });
    await expect(api.exportCustomers({ q: 'sara' })).resolves.toBe('csv');
    await api.customerOrders(HANDLE, { cursor: 'c1' });
    await api.customerSessions(HANDLE);
    await api.customerActivity(HANDLE, {});
    await api.suspendCustomer(HANDLE, { reasonCategory: 'abuse', reason: 'Automated scripts' });
    await api.reactivateCustomer(HANDLE, reason);
    await api.signOutCustomer(HANDLE, reason);
    await api.sendCustomerReset(HANDLE, reason);
    await api.resetCustomerAccount(HANDLE, { ...reason, confirm: `RESET ${HANDLE}` });
    await api.revealCustomer(HANDLE);
    await api.invites();
    await expect(api.createInvite({ email: INVITE.email, role: 'VIEWER' })).resolves.toEqual(
      INVITE,
    );
    await expect(api.resendInvite('inv-1')).resolves.toEqual(INVITE);
    await api.revokeInvite('inv-1');
    await api.inviteInfo('tok');
    await expect(
      api.acceptInvite({ token: 't'.repeat(16), name: 'Sam', password: 'a long phrase' }),
    ).resolves.toEqual(makeAdminUser());

    expect(calls).toEqual([
      'GET /api/v1/admin/customers?status=all&limit=50',
      'GET /api/v1/admin/customers/export.csv?q=sara',
      'GET /api/v1/admin/customers/ACC-7F2A9C/orders?cursor=c1',
      'GET /api/v1/admin/customers/ACC-7F2A9C/sessions',
      'GET /api/v1/admin/customers/ACC-7F2A9C/activity',
      'POST /api/v1/admin/customers/ACC-7F2A9C/suspend {"reasonCategory":"abuse","reason":"Automated scripts"}',
      'POST /api/v1/admin/customers/ACC-7F2A9C/reactivate {"reason":"Customer asked for it"}',
      'POST /api/v1/admin/customers/ACC-7F2A9C/sign-out-all {"reason":"Customer asked for it"}',
      'POST /api/v1/admin/customers/ACC-7F2A9C/password-reset {"reason":"Customer asked for it"}',
      'POST /api/v1/admin/customers/ACC-7F2A9C/reset-account {"reason":"Customer asked for it","confirm":"RESET ACC-7F2A9C"}',
      'POST /api/v1/admin/customers/ACC-7F2A9C/reveal',
      'GET /api/v1/admin/invites',
      'POST /api/v1/admin/invites {"email":"sam@minitrading.dev","role":"VIEWER"}',
      'POST /api/v1/admin/invites/inv-1/resend',
      'DELETE /api/v1/admin/invites/inv-1',
      'GET /api/v1/admin/invites/token/tok',
      `POST /api/v1/admin/invites/accept {"token":"${'t'.repeat(16)}","name":"Sam","password":"a long phrase"}`,
    ]);
  });

  it('never sends an invitee to the admin sign-in page', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve(null) }),
    ) as unknown as typeof fetch;
    const onUnauthorized = jest.fn();
    const api = createAdminApi({ onUnauthorized });

    await expect(api.inviteInfo('tok')).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});

describe('customer hooks', () => {
  it('pages through customers by cursor and reports the total', async () => {
    const customers = jest
      .fn()
      .mockResolvedValueOnce({ items: [makeRow()], nextCursor: 'c1', total: 2 })
      .mockResolvedValueOnce({ items: [makeRow({ id: 'u2' })], nextCursor: null, total: 2 });
    const { Wrapper } = createAdminWrapper({ customers });
    const query = customersQuery({ q: '', status: 'all', verified: false, hasOpenOrders: false });
    const { result } = renderHook(() => useCustomers(query), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.items).toHaveLength(1);
    });
    expect(result.current).toMatchObject({ total: 2, hasNextPage: true });

    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => {
      expect(result.current.items.map((row) => row.id)).toEqual(['u1', 'u2']);
    });
    expect(customers).toHaveBeenLastCalledWith(
      { status: 'all', limit: 50, cursor: 'c1' },
      expect.anything(),
    );
    expect(result.current.hasNextPage).toBe(false);
  });

  it('loads the KPIs, the detail and every tab', async () => {
    const api = {
      customerKpis: jest.fn(() => Promise.resolve({ registered: 1 } as never)),
      customer: jest.fn(() => Promise.resolve({ customer: makeRow() } as never)),
      customerOrders: jest.fn(() => Promise.resolve({ items: [makeOrder()], nextCursor: null })),
      customerSessions: jest.fn(() => Promise.resolve({ items: [] })),
      customerActivity: jest.fn(() => Promise.resolve({ items: [], nextCursor: null })),
    };
    const { Wrapper } = createAdminWrapper(api);
    const { result } = renderHook(
      () => ({
        kpis: useCustomerKpis(),
        detail: useCustomer(HANDLE),
        orders: useCustomerOrders(HANDLE),
        sessions: useCustomerSessions(HANDLE),
        activity: useCustomerActivity(HANDLE),
      }),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(result.current.activity.isLoading).toBe(false);
    });
    await waitFor(() => {
      expect(result.current.detail.data?.customer.handle).toBe(HANDLE);
    });
    expect(result.current.kpis.data).toEqual({ registered: 1 });
    await waitFor(() => {
      expect(result.current.orders.items[0]?.notionalCents).toBe(makeOrder().amountCents);
    });
    expect(result.current.orders.hasNextPage).toBe(false);
    expect(api.customerActivity).toHaveBeenCalledWith(
      HANDLE,
      { cursor: undefined },
      expect.anything(),
    );
  });

  it('refreshes every customer view after an action', async () => {
    const api = {
      suspendCustomer: jest.fn(() => Promise.resolve(ACTION)),
      reactivateCustomer: jest.fn(() => Promise.resolve(ACTION)),
      signOutCustomer: jest.fn(() => Promise.resolve(ACTION)),
      sendCustomerReset: jest.fn(() => Promise.resolve(ACTION)),
      resetCustomerAccount: jest.fn(() => Promise.resolve(ACTION)),
    };
    const { Wrapper, queryClient } = createAdminWrapper(api);
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(
      () => ({
        suspend: useSuspendCustomer(),
        reactivate: useReactivateCustomer(),
        signOut: useSignOutCustomer(),
        reset: useSendCustomerReset(),
        resetAccount: useResetCustomerAccount(),
      }),
      { wrapper: Wrapper },
    );
    const reason = 'Customer asked for it';

    await act(async () => {
      await result.current.suspend.mutateAsync({
        handle: HANDLE,
        body: { reasonCategory: 'fraud', reason },
      });
      await result.current.reactivate.mutateAsync({ handle: HANDLE, body: { reason } });
      await result.current.signOut.mutateAsync({ handle: HANDLE, body: { reason } });
      await result.current.reset.mutateAsync({ handle: HANDLE, body: { reason } });
      await result.current.resetAccount.mutateAsync({
        handle: HANDLE,
        body: { reason, confirm: `RESET ${HANDLE}` },
      });
    });

    for (const call of Object.values(api)) expect(call).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledTimes(5);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: adminKeys.customersAll });
  });

  it('reveals full IPs by session id', async () => {
    const revealCustomer = jest.fn(() =>
      Promise.resolve({ items: [{ sessionId: 's1', ip: '41.32.10.7' }] }),
    );
    const { Wrapper } = createAdminWrapper({ revealCustomer });
    const { result } = renderHook(() => useRevealCustomer(HANDLE), { wrapper: Wrapper });

    act(() => {
      result.current.reveal();
    });

    await waitFor(() => {
      expect(result.current.ips.get('s1')).toBe('41.32.10.7');
    });
  });
});

describe('export and missing customers', () => {
  it('hands the CSV for the filters to the app to save', async () => {
    const exportCustomers = jest.fn(() => Promise.resolve('handle,name'));
    const save = jest.fn();
    const { Wrapper } = createAdminWrapper({ exportCustomers });
    const { result } = renderHook(() => useExportCustomers({ save }), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({ status: 'suspended' });
    });

    expect(exportCustomers).toHaveBeenCalledWith({ status: 'suspended' });
    expect(save).toHaveBeenCalledWith('customers', 'handle,name');
  });

  it('lets the detail page tell a missing handle apart', async () => {
    const customer = jest.fn(() => Promise.reject(makeProblem(404)));
    const { Wrapper } = createAdminWrapper({ customer });
    const { result } = renderHook(() => useCustomer('ACC-000000'), { wrapper: Wrapper });

    await waitFor(() => {
      expect(isApiError(result.current.error, ErrorCode.NotFound)).toBe(true);
    });
  });
});

describe('team invites', () => {
  it('lists, sends, resends and revokes invites, refreshing the list', async () => {
    const api = {
      invites: jest.fn(() => Promise.resolve({ items: [INVITE] })),
      createInvite: jest.fn(() => Promise.resolve(INVITE)),
      resendInvite: jest.fn(() => Promise.resolve(INVITE)),
      revokeInvite: jest.fn(() => Promise.resolve()),
    };
    const { Wrapper } = createAdminWrapper(api);
    const { result } = renderHook(
      () => ({
        list: useInvites(),
        create: useCreateInvite(),
        resend: useResendInvite(),
        revoke: useRevokeInvite(),
      }),
      { wrapper: Wrapper },
    );
    await waitFor(() => {
      expect(result.current.list.data?.items).toEqual([INVITE]);
    });

    await act(async () => {
      await result.current.create.mutateAsync({ email: INVITE.email, role: 'VIEWER' });
      await result.current.resend.mutateAsync('inv-1');
      await result.current.revoke.mutateAsync('inv-1');
    });

    expect(api.resendInvite).toHaveBeenCalledWith('inv-1');
    expect(api.invites).toHaveBeenCalledTimes(4);
  });

  it('shows the invite and signs the new admin in on accept', async () => {
    const user = makeAdminUser({ role: 'VIEWER' });
    const api = {
      inviteInfo: jest.fn(() =>
        Promise.resolve({
          email: INVITE.email,
          role: 'VIEWER' as const,
          expiresAt: INVITE.expiresAt,
        }),
      ),
      acceptInvite: jest.fn(() => Promise.resolve(user)),
    };
    const onSuccess = jest.fn();
    const { Wrapper, queryClient } = createAdminWrapper(api);
    const { result } = renderHook(
      () => ({ info: useInviteInfo('tok'), accept: useAcceptInvite({ onSuccess }) }),
      { wrapper: Wrapper },
    );
    await waitFor(() => {
      expect(result.current.info.data?.email).toBe(INVITE.email);
    });

    await act(async () => {
      await result.current.accept.mutateAsync({
        token: 't'.repeat(16),
        name: 'Sam',
        password: 'a long phrase',
      });
    });

    expect(queryClient.getQueryData(adminKeys.session)).toEqual(user);
    expect(onSuccess).toHaveBeenCalled();
  });
});
