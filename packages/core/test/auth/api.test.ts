import { createApiClient } from '../../src/api';

const DEVICE_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
const USER = {
  id: 'u1',
  email: 'sara@example.com',
  name: 'Sara',
  emailVerified: false,
  createdAt: 1,
  passwordChangedAt: null,
  account: { id: 'a1', handle: 'ACC-7F2A9C' },
};
const SESSION = { user: USER, accessExpiresAt: 2 };
const ACCOUNT = {
  id: 'a1',
  handle: 'ACC-7F2A9C',
  cashCents: 1,
  startingCashCents: 1,
  createdAt: 0,
  resetAt: null,
};

const BODIES: Record<string, unknown> = {
  'POST /api/v1/auth/sign-up': SESSION,
  'POST /api/v1/auth/sign-in': SESSION,
  'POST /api/v1/auth/refresh': SESSION,
  'GET /api/v1/auth/reset/tok%2Fen': { email: 'sara@example.com' },
  'POST /api/v1/auth/reset': { ...SESSION, sessionsRevoked: 2 },
  'POST /api/v1/auth/verify': { email: 'sara@example.com' },
  'GET /api/v1/me': { user: USER },
  'PATCH /api/v1/me/profile': { user: { ...USER, name: 'Sara A' } },
  'POST /api/v1/me/password': { sessionsRevoked: 1 },
  'GET /api/v1/me/summary': { equityCents: 1, openOrders: 0, watchlist: 0, alerts: 0 },
  'GET /api/v1/auth/sessions': { items: [] },
  'POST /api/v1/auth/sessions/revoke-others': { revoked: 1, labels: ['Chrome on macOS'] },
  'POST /api/v1/me/delete': { purgeAt: 9 },
  'POST /api/v1/me/account/reset': { account: ACCOUNT },
};

describe('auth api', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('calls every auth endpoint with the right path, method and body', async () => {
    const calls: string[] = [];
    global.fetch = jest.fn((url: string, init: RequestInit) => {
      const call = `${init.method ?? 'GET'} ${url.replace('http://api', '')}`;
      calls.push(init.body ? `${call} ${init.body as string}` : call);
      const body = BODIES[call];
      return Promise.resolve({
        ok: true,
        status: body === undefined ? 204 : 200,
        json: () => Promise.resolve(body),
      });
    }) as unknown as typeof fetch;
    const api = createApiClient({
      baseUrl: 'http://api',
      getDeviceId: () => Promise.resolve(DEVICE_ID),
    });
    const login = { email: 'sara@example.com', password: 'longer phrase' };

    await expect(api.signUp({ ...login, name: 'Sara', terms: true })).resolves.toEqual(SESSION);
    await api.signIn(login);
    await api.signOut();
    await api.refreshSession({ refreshToken: 'r1' });
    await api.forgotPassword({ email: login.email });
    await expect(api.getResetInfo('tok/en')).resolves.toEqual({ email: login.email });
    await api.resetPassword({ token: 'a'.repeat(16), password: 'longer phrase' });
    await api.verifyEmail({ token: 'a'.repeat(16) });
    await api.resendVerification();
    await expect(api.getMe()).resolves.toEqual(USER);
    await expect(api.updateProfile({ name: 'Sara A' })).resolves.toMatchObject({ name: 'Sara A' });
    await api.changePassword({ current: 'old password', next: 'new password' });
    await api.getMeSummary();
    await api.listSessions();
    await api.revokeSession('s1');
    await api.signOutOthers();
    await api.deleteAccount({ password: 'longer phrase', confirm: 'DELETE' });
    await api.selfReset({ confirm: 'RESET' });

    expect(calls).toEqual([
      'POST /api/v1/auth/sign-up {"email":"sara@example.com","password":"longer phrase","name":"Sara","terms":true}',
      'POST /api/v1/auth/sign-in {"email":"sara@example.com","password":"longer phrase"}',
      'POST /api/v1/auth/sign-out',
      'POST /api/v1/auth/refresh {"refreshToken":"r1"}',
      'POST /api/v1/auth/forgot {"email":"sara@example.com"}',
      'GET /api/v1/auth/reset/tok%2Fen',
      `POST /api/v1/auth/reset {"token":"${'a'.repeat(16)}","password":"longer phrase"}`,
      `POST /api/v1/auth/verify {"token":"${'a'.repeat(16)}"}`,
      'POST /api/v1/auth/verify/resend {}',
      'GET /api/v1/me',
      'PATCH /api/v1/me/profile {"name":"Sara A"}',
      'POST /api/v1/me/password {"current":"old password","next":"new password"}',
      'GET /api/v1/me/summary',
      'GET /api/v1/auth/sessions',
      'DELETE /api/v1/auth/sessions/s1',
      'POST /api/v1/auth/sessions/revoke-others',
      'POST /api/v1/me/delete {"password":"longer phrase","confirm":"DELETE"}',
      'POST /api/v1/me/account/reset {"confirm":"RESET"}',
    ]);
  });

  it('never renews the session for sign-in or a resend from an emailed link', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve(null) }),
    ) as unknown as typeof fetch;
    const refresh = jest.fn(() => Promise.resolve(false));
    const api = createApiClient({
      baseUrl: 'http://api',
      getDeviceId: () => Promise.resolve(DEVICE_ID),
      auth: { refresh },
    });

    await expect(api.signIn({ email: 'a@b.co', password: 'x' })).rejects.toThrow();
    await expect(api.resendVerification({ email: 'a@b.co' })).rejects.toThrow();
    expect(refresh).not.toHaveBeenCalled();

    await expect(api.resendVerification()).rejects.toThrow();
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
