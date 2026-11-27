import { createAdminApi } from '../../src/admin/api';
import {
  makeAccount,
  makeAdminStock,
  makeAdminTrading,
  makeAdminUser,
  makeConfig,
} from './fixtures';

type Call = [string, RequestInit];

function respond(status: number, body: unknown = {}) {
  return jest.fn((_url: string, _init: RequestInit) =>
    Promise.resolve({
      ok: status < 400,
      status,
      statusText: 'status',
      json: () => Promise.resolve(body),
    }),
  );
}

describe('createAdminApi', () => {
  const originalFetch = global.fetch;
  let fetchMock: ReturnType<typeof respond>;
  const use = (mock: ReturnType<typeof respond>) => {
    fetchMock = mock;
    global.fetch = mock as unknown as typeof fetch;
  };
  const lastCall = () => fetchMock.mock.calls.at(-1) as Call;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('sends the session cookie to the same-origin API', async () => {
    use(respond(200, { user: makeAdminUser() }));
    const api = createAdminApi();

    await expect(api.me()).resolves.toEqual(makeAdminUser());

    const [url, init] = lastCall();
    expect(url).toBe('/api/v1/admin/auth/me');
    expect(init.credentials).toBe('include');
  });

  it('redirects to sign-in on a 401, but not for a failed login', async () => {
    const onUnauthorized = jest.fn();
    use(respond(401, { type: 'x', title: 'Unauthorized', status: 401, code: 'UNAUTHORIZED' }));
    const api = createAdminApi({ onUnauthorized });

    await expect(api.login({ email: 'a@b.co', password: 'password1' })).rejects.toMatchObject({
      status: 401,
    });
    expect(onUnauthorized).not.toHaveBeenCalled();

    await expect(api.stats()).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('does not redirect on other errors', async () => {
    const onUnauthorized = jest.fn();
    use(respond(403, { type: 'x', title: 'Forbidden', status: 403, code: 'FORBIDDEN' }));

    await expect(createAdminApi({ onUnauthorized }).listUsers()).rejects.toMatchObject({
      status: 403,
    });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it.each([
    [
      'logout',
      (api: ReturnType<typeof createAdminApi>) => api.logout(),
      'POST',
      '/admin/auth/logout',
      204,
      undefined,
    ],
    [
      'market',
      (api: ReturnType<typeof createAdminApi>) => api.marketCommand({ action: 'pause' }),
      'POST',
      '/admin/market',
      200,
      { status: { state: 'paused', volatility: 1, since: 1 } },
    ],
    [
      'config',
      (api: ReturnType<typeof createAdminApi>) => api.updateConfig({ maintenanceMode: true }),
      'PATCH',
      '/admin/config',
      200,
      makeConfig(),
    ],
    [
      'health',
      (api: ReturnType<typeof createAdminApi>) => api.health(),
      'GET',
      '/health',
      200,
      { status: 'ok', uptimeSeconds: 1, version: '1.0.0', commit: 'abc1234' },
    ],
    [
      'get config',
      (api: ReturnType<typeof createAdminApi>) => api.getConfig(),
      'GET',
      '/app-config',
      200,
      makeConfig(),
    ],
    [
      'stocks',
      (api: ReturnType<typeof createAdminApi>) => api.listStocks(),
      'GET',
      '/admin/stocks',
      200,
      { items: [makeAdminStock()] },
    ],
    [
      'create stock',
      (api: ReturnType<typeof createAdminApi>) =>
        api.createStock({
          symbol: 'AAPL',
          name: 'Apple',
          sector: 'tech',
          exchange: 'NASDAQ',
          basePrice: 1,
          volatility: 1,
        }),
      'POST',
      '/admin/stocks',
      200,
      makeAdminStock(),
    ],
    [
      'update stock',
      (api: ReturnType<typeof createAdminApi>) => api.updateStock('BRK.B', { isEnabled: false }),
      'PATCH',
      '/admin/stocks/BRK.B',
      200,
      makeAdminStock(),
    ],
    [
      'delete stock',
      (api: ReturnType<typeof createAdminApi>) => api.deleteStock('AAPL'),
      'DELETE',
      '/admin/stocks/AAPL',
      204,
      undefined,
    ],
    [
      'users',
      (api: ReturnType<typeof createAdminApi>) => api.listUsers(),
      'GET',
      '/admin/users',
      200,
      { items: [] },
    ],
    [
      'create user',
      (api: ReturnType<typeof createAdminApi>) =>
        api.createUser({ email: 'a@b.co', name: 'A', role: 'VIEWER', password: 'password1' }),
      'POST',
      '/admin/users',
      200,
      makeAdminUser(),
    ],
    [
      'update user',
      (api: ReturnType<typeof createAdminApi>) => api.updateUser('u1', { role: 'VIEWER' }),
      'PATCH',
      '/admin/users/u1',
      200,
      makeAdminUser(),
    ],
    [
      'audit',
      (api: ReturnType<typeof createAdminApi>) =>
        api.audit({ page: 2, action: 'market.pause', actor: '' }),
      'GET',
      '/admin/audit?page=2&action=market.pause',
      200,
      { items: [], page: 2, pageSize: 25, total: 0 },
    ],
    [
      'trading',
      (api: ReturnType<typeof createAdminApi>) => api.trading(),
      'GET',
      '/admin/trading',
      200,
      makeAdminTrading(),
    ],
    [
      'update trading',
      (api: ReturnType<typeof createAdminApi>) => api.updateTrading({ tradingEnabled: false }),
      'PATCH',
      '/admin/trading',
      200,
      makeAdminTrading(),
    ],
    [
      'impact',
      (api: ReturnType<typeof createAdminApi>) => api.haltImpact('TSLA'),
      'GET',
      '/admin/halts/impact?symbol=TSLA',
      200,
      { symbol: 'TSLA', openOrders: 1, holdersAndWatchers: 2 },
    ],
    [
      'halt',
      (api: ReturnType<typeof createAdminApi>) =>
        api.createHalt({ symbol: 'TSLA', message: 'News', duration: '5m', notify: true }),
      'POST',
      '/admin/halts',
      200,
      { symbol: 'TSLA', source: 'admin', message: 'News', since: 1, resumesAt: null },
    ],
    [
      'resume',
      (api: ReturnType<typeof createAdminApi>) => api.resumeHalt('TSLA'),
      'POST',
      '/admin/halts/TSLA/resume',
      204,
      undefined,
    ],
    [
      'orders',
      (api: ReturnType<typeof createAdminApi>) => api.orders({ status: 'rejected', limit: 50 }),
      'GET',
      '/admin/orders?status=rejected&limit=50',
      200,
      { items: [] },
    ],
    [
      'order stats',
      (api: ReturnType<typeof createAdminApi>) => api.orderStats(),
      'GET',
      '/admin/orders/stats',
      200,
      {
        ordersToday: 1,
        fillRateBps: 1,
        rejectedBps: 1,
        notionalTodayCents: 1,
        activeTraders: 1,
        rejectionsByReason: [],
        typeMix: [],
        amountOrders: 0,
      },
    ],
    [
      'accounts',
      (api: ReturnType<typeof createAdminApi>) => api.accounts({ q: 'ACC', sort: 'equity' }),
      'GET',
      '/admin/accounts?q=ACC&sort=equity',
      200,
      { items: [makeAccount()], total: 1, page: 1, pageSize: 25 },
    ],
  ] as const)('calls %s', async (_name, call, method, path, status, body) => {
    use(respond(status, body));

    await call(createAdminApi());

    const [url, init] = lastCall();
    expect(url).toBe(`/api/v1${path}`);
    expect(init.method ?? 'GET').toBe(method);
  });

  it('resets an account with the typed confirmation', async () => {
    use(
      respond(200, {
        id: 'acc-1',
        handle: 'ACC-00AA11',
        cashCents: 1,
        startingCashCents: 1,
        createdAt: 1,
        resetAt: 2,
      }),
    );

    await createAdminApi().resetAccount('acc-1', 'RESET ACC-00AA11');

    const [url, init] = lastCall();
    expect(url).toBe('/api/v1/admin/accounts/acc-1/reset');
    expect(JSON.parse(init.body as string)).toEqual({ confirm: 'RESET ACC-00AA11' });
  });
});
