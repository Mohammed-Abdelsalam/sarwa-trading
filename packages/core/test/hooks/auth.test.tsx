import { act, renderHook, waitFor } from '@testing-library/react';

import { ErrorCode, type ErrorCodeValue } from '@sarwa/contracts';

import { ApiError } from '../../src/api';
import {
  authFailure,
  clockText,
  useChangePassword,
  useDeleteAccount,
  useForgotPassword,
  useMeSummary,
  useResendVerification,
  useResetPassword,
  useRevokeSession,
  useSelfReset,
  useSessions,
  useSignIn,
  useSignOut,
  useSignOutOthers,
  useSignUp,
  useUpdateProfile,
  useVerifyEmail,
} from '../../src/hooks/auth';
import { meKeys } from '../../src/hooks/keys';
import { createAuthClient, createWrapper, makeUser } from '../utils';

function problem(status: number, code: ErrorCodeValue, extra: Record<string, unknown> = {}) {
  const body = { type: 'about:blank', title: 'Error', status, code };
  return new ApiError(body, { ...body, ...extra });
}

const SESSION = { user: makeUser(), accessExpiresAt: 1 };
const LOGIN = { email: 'Sara@Example.com', password: 'a long phrase' };
const SUSPENSION = {
  reasonCategory: 'abuse',
  reason: 'Automated trading scripts',
  at: 3,
  accountHandle: 'ACC-7F2A9C',
};
const TOKEN = 't'.repeat(32);

function setup<T>(
  hook: () => T,
  api: Parameters<typeof createAuthClient>[0] = {},
  status: 'guest' | 'authenticated' = 'guest',
) {
  const client = createAuthClient(api, { status });
  const { Wrapper, queryClient } = createWrapper(client);
  const view = renderHook(hook, { wrapper: Wrapper });
  return { client, queryClient, ...view };
}

describe('authFailure and clockText', () => {
  it('maps codes to a banner, field codes or offline', () => {
    expect(authFailure(problem(401, ErrorCode.InvalidCredentials))).toEqual({
      code: 'INVALID_CREDENTIALS',
      fields: {},
    });
    const invalid = new ApiError({
      type: 'about:blank',
      title: 'Invalid',
      status: 400,
      code: ErrorCode.ValidationFailed,
      errors: { email: ['EMAIL_INVALID'], name: ['Required'] },
    });
    expect(authFailure(invalid)).toEqual({ code: null, fields: { email: 'EMAIL_INVALID' } });
    expect(authFailure(problem(500, ErrorCode.Internal)).code).toBe('UNKNOWN');
    expect(authFailure(new TypeError('Network request failed')).code).toBe('OFFLINE');
  });

  it('writes a countdown as m:ss', () => {
    expect(clockText(42)).toBe('0:42');
    expect(clockText(60)).toBe('1:00');
    expect(clockText(905)).toBe('15:05');
  });
});

describe('useSignUp', () => {
  it('checks the form before sending anything', () => {
    const signUp = jest.fn();
    const { result } = setup(() => useSignUp(), { signUp });

    act(() => {
      result.current.submit({
        name: ' ',
        email: 'sara',
        password: '12345678',
        terms: false as never,
      });
    });

    expect(signUp).not.toHaveBeenCalled();
    expect(result.current.fieldErrors).toEqual({
      name: 'NAME_REQUIRED',
      email: 'EMAIL_INVALID',
      password: 'PASSWORD_COMMON',
      terms: 'TERMS_REQUIRED',
    });
  });

  it('creates the account, signs in and reports a claimed guest portfolio', async () => {
    const claimed = { positions: 2, openOrders: 1, watchlist: 3 };
    const signUp = jest.fn(() => Promise.resolve({ ...SESSION, claimed }));
    const { result, client } = setup(() => useSignUp(), { signUp });

    act(() => {
      result.current.submit({ ...LOGIN, name: 'Sara', terms: true });
    });

    await waitFor(() => {
      expect(result.current.data?.claimed).toEqual(claimed);
    });
    expect(signUp).toHaveBeenCalledWith({
      name: 'Sara',
      email: 'sara@example.com',
      password: 'a long phrase',
      terms: true,
      keepSignedIn: false,
    });
    expect(client.auth.session.getState().status).toBe('authenticated');
    expect(client.auth.transport.save).toHaveBeenCalled();
  });

  it('shows an email already in use as a banner', async () => {
    const signUp = jest.fn(() => Promise.reject(problem(409, ErrorCode.EmailInUse)));
    const { result } = setup(() => useSignUp(), { signUp });

    act(() => {
      result.current.submit({ ...LOGIN, name: 'Sara', terms: true });
    });

    await waitFor(() => {
      expect(result.current.error).toBe('EMAIL_IN_USE');
    });
  });
});

describe('useSignIn', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('says wrong credentials, or offline, without signing in', async () => {
    const signIn = jest
      .fn()
      .mockRejectedValueOnce(problem(401, ErrorCode.InvalidCredentials))
      .mockRejectedValueOnce(new TypeError('Network request failed'));
    const { result, client } = setup(() => useSignIn(), { signIn });

    act(() => {
      result.current.submit(LOGIN);
    });
    await waitFor(() => {
      expect(result.current.error).toBe('INVALID_CREDENTIALS');
    });

    act(() => {
      result.current.submit(LOGIN);
    });
    await waitFor(() => {
      expect(result.current.error).toBe('OFFLINE');
    });
    expect(client.auth.session.getState().status).toBe('guest');
  });

  it('counts a rate limit down and blocks sending until it is over', async () => {
    jest.useFakeTimers();
    const signIn = jest.fn(() =>
      Promise.reject(problem(429, ErrorCode.RateLimited, { retryAfterSeconds: 42 })),
    );
    const { result } = setup(() => useSignIn(), { signIn });

    act(() => {
      result.current.submit(LOGIN);
    });
    await waitFor(() => {
      expect(result.current.retryIn).toBe('0:42');
    });
    expect(result.current).toMatchObject({ error: 'RATE_LIMITED', canSubmit: false });

    act(() => {
      result.current.submit(LOGIN);
    });
    expect(signIn).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(42_000);
    });
    expect(result.current).toMatchObject({
      retryIn: null,
      error: null,
      retryReady: true,
      canSubmit: true,
    });
  });

  it('asks before replacing this device’s guest data, then resends with the ticket', async () => {
    const signIn = jest
      .fn()
      .mockRejectedValueOnce(
        problem(409, ErrorCode.GuestDataPresent, {
          ticket: 'ticket-1',
          positions: 3,
          openOrders: 1,
          watchlist: 7,
        }),
      )
      .mockResolvedValueOnce(SESSION);
    const { result, client } = setup(() => useSignIn(), { signIn });

    act(() => {
      result.current.submit(LOGIN);
    });
    await waitFor(() => {
      expect(result.current.needsDiscard).toBe(true);
    });
    expect(result.current).toMatchObject({
      error: null,
      counts: { positions: 3, openOrders: 1, watchlist: 7 },
    });

    act(() => {
      result.current.confirm();
    });
    await waitFor(() => {
      expect(client.auth.session.getState().status).toBe('authenticated');
    });
    expect(signIn).toHaveBeenLastCalledWith(
      expect.objectContaining({ guestTicket: 'ticket-1', email: 'sara@example.com' }),
    );
  });

  it('keeps the guest state when the replace is canceled', async () => {
    const signIn = jest.fn(() =>
      Promise.reject(
        problem(409, ErrorCode.GuestDataPresent, {
          ticket: 'ticket-1',
          positions: 1,
          openOrders: 0,
          watchlist: 0,
        }),
      ),
    );
    const { result, client } = setup(() => useSignIn(), { signIn });
    act(() => {
      result.current.submit(LOGIN);
    });
    await waitFor(() => {
      expect(result.current.needsDiscard).toBe(true);
    });

    act(() => {
      result.current.cancel();
    });

    expect(result.current).toMatchObject({ needsDiscard: false, error: null });
    expect(signIn).toHaveBeenCalledTimes(1);
    expect(client.auth.session.getState().status).toBe('guest');
  });

  it('moves a suspended customer to the suspended screen', async () => {
    const signIn = jest.fn(() =>
      Promise.reject(problem(403, ErrorCode.AccountSuspended, { suspension: SUSPENSION })),
    );
    const { result, client } = setup(() => useSignIn(), { signIn });

    act(() => {
      result.current.submit(LOGIN);
    });

    await waitFor(() => {
      expect(client.auth.session.getState()).toMatchObject({
        status: 'suspended',
        suspension: SUSPENSION,
      });
    });
    expect(result.current.error).toBe('ACCOUNT_SUSPENDED');
  });
});

describe('useSignOut', () => {
  it('signs out here even when the server cannot be reached', async () => {
    const signOut = jest.fn(() => Promise.reject(new TypeError('offline')));
    const { result, client } = setup(() => useSignOut(), { signOut }, 'authenticated');

    act(() => {
      result.current.signOut();
    });

    await waitFor(() => {
      expect(client.auth.session.getState()).toMatchObject({
        status: 'guest',
        revokedReason: null,
      });
    });
    expect(client.auth.transport.clear).toHaveBeenCalled();
  });
});

describe('useForgotPassword', () => {
  it('shows the neutral sent state and waits a minute before a resend', async () => {
    const forgotPassword = jest.fn(() => Promise.resolve());
    const { result } = setup(() => useForgotPassword(), { forgotPassword });

    act(() => {
      result.current.submit({ email: 'sara@example.com' });
    });
    await waitFor(() => {
      expect(result.current.sentTo).toBe('sara@example.com');
    });
    await waitFor(() => {
      expect(result.current.resendIn).toBe('1:00');
    });

    act(() => {
      result.current.resend();
    });
    expect(forgotPassword).toHaveBeenCalledTimes(1);
  });
});

describe('useResetPassword', () => {
  it('names the account, checks both passwords match and signs in', async () => {
    const resetPassword = jest.fn(() => Promise.resolve({ ...SESSION, sessionsRevoked: 2 }));
    const getResetInfo = jest.fn(() => Promise.resolve({ email: 'sara@example.com' }));
    const { result, client } = setup(() => useResetPassword(TOKEN), {
      resetPassword,
      getResetInfo,
    });
    await waitFor(() => {
      expect(result.current).toMatchObject({ link: 'ready', email: 'sara@example.com' });
    });

    act(() => {
      result.current.submit({ password: 'a long phrase', confirm: 'a long phrasf' });
    });
    expect(result.current.fieldErrors).toEqual({ confirm: 'PASSWORDS_DIFFER' });
    expect(resetPassword).not.toHaveBeenCalled();

    act(() => {
      result.current.submit({ password: 'a long phrase', confirm: 'a long phrase' });
    });
    await waitFor(() => {
      expect(result.current.sessionsRevoked).toBe(2);
    });
    expect(resetPassword).toHaveBeenCalledWith({
      token: TOKEN,
      password: 'a long phrase',
      keepSignedIn: false,
    });
    expect(client.auth.session.getState().status).toBe('authenticated');
  });

  it('sends the device model so the new session is labelled', async () => {
    const resetPassword = jest.fn(() => Promise.resolve({ ...SESSION, sessionsRevoked: 0 }));
    const { result } = setup(() => useResetPassword(TOKEN), {
      resetPassword,
      getResetInfo: () => Promise.resolve({ email: 'sara@example.com' }),
    });
    act(() => {
      result.current.submit({
        password: 'a long phrase',
        confirm: 'a long phrase',
        keepSignedIn: true,
        deviceModel: 'iPhone 15',
      });
    });
    await waitFor(() => {
      expect(resetPassword).toHaveBeenCalledWith({
        token: TOKEN,
        password: 'a long phrase',
        keepSignedIn: true,
        deviceModel: 'iPhone 15',
      });
    });
  });

  it('tells an expired link from a broken one', async () => {
    const getResetInfo = jest.fn(() => Promise.reject(problem(410, ErrorCode.TokenExpired)));
    const { result } = setup(() => useResetPassword(TOKEN), { getResetInfo });
    await waitFor(() => {
      expect(result.current.link).toBe('expired');
    });

    const broken = setup(() => useResetPassword(TOKEN), {
      getResetInfo: () => Promise.reject(problem(500, ErrorCode.Internal)),
    });
    await waitFor(() => {
      expect(broken.result.current.link).toBe('failed');
    });
  });
});

describe('useVerifyEmail and useResendVerification', () => {
  it('verifies once and marks the signed-in customer verified', async () => {
    const verifyEmail = jest.fn(() => Promise.resolve({ email: 'sara@example.com' }));
    const { result, client, rerender } = setup(
      () => useVerifyEmail(TOKEN),
      { verifyEmail },
      'authenticated',
    );

    await waitFor(() => {
      expect(result.current).toEqual({ state: 'ready', email: 'sara@example.com' });
    });
    rerender();
    expect(verifyEmail).toHaveBeenCalledTimes(1);
    expect(client.auth.session.getState().user?.emailVerified).toBe(true);
  });

  it('offers a resend to the address an expired link names', async () => {
    const verifyEmail = jest.fn(() =>
      Promise.reject(problem(410, ErrorCode.TokenExpired, { email: 'sara@example.com' })),
    );
    const resendVerification = jest.fn(() => Promise.resolve());
    const { result } = setup(
      () => ({ verify: useVerifyEmail(TOKEN), resend: useResendVerification() }),
      { verifyEmail, resendVerification },
    );
    await waitFor(() => {
      expect(result.current.verify).toEqual({ state: 'expired', email: 'sara@example.com' });
    });

    act(() => {
      result.current.resend.resend('sara@example.com');
    });

    await waitFor(() => {
      expect(result.current.resend).toMatchObject({
        sent: true,
        canResend: false,
        resendIn: '1:00',
      });
    });
    expect(resendVerification).toHaveBeenCalledWith({ email: 'sara@example.com' });
  });
});

describe('account settings', () => {
  it('changes the password, or says the current one is wrong', async () => {
    const changePassword = jest
      .fn()
      .mockRejectedValueOnce(problem(400, ErrorCode.InvalidCurrentPassword))
      .mockResolvedValueOnce({ sessionsRevoked: 2 });
    const onSuccess = jest.fn();
    const { result, queryClient } = setup(
      () => useChangePassword({ onSuccess }),
      { changePassword },
      'authenticated',
    );
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');
    const form = { current: 'old phrase', next: 'a new long phrase', confirm: 'a new long phrase' };

    act(() => {
      result.current.submit(form);
    });
    await waitFor(() => {
      expect(result.current.error).toBe('INVALID_CURRENT_PASSWORD');
    });

    act(() => {
      result.current.submit(form);
    });
    await waitFor(() => {
      expect(result.current.sessionsRevoked).toBe(2);
    });
    expect(changePassword).toHaveBeenLastCalledWith({
      current: 'old phrase',
      next: 'a new long phrase',
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: meKeys('u1').sessions });
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('saves the profile name into the session', async () => {
    const updateProfile = jest.fn(() => Promise.resolve(makeUser({ name: 'Sara Ali' })));
    const onSuccess = jest.fn();
    const { result, client } = setup(
      () => useUpdateProfile({ onSuccess }),
      { updateProfile },
      'authenticated',
    );

    act(() => {
      result.current.submit({ name: '  Sara Ali ' });
    });

    await waitFor(() => {
      expect(client.auth.session.getState().user?.name).toBe('Sara Ali');
    });
    expect(updateProfile).toHaveBeenCalledWith({ name: 'Sara Ali' });
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('lists this device apart from the others and signs them out', async () => {
    const session = (id: string, current: boolean) => ({
      id,
      label: id,
      platform: 'web' as const,
      ipMasked: '41.32.•.•',
      lastActiveAt: 1,
      createdAt: 1,
      current,
    });
    const listSessions = jest.fn(() =>
      Promise.resolve({ items: [session('here', true), session('phone', false)] }),
    );
    const revokeSession = jest.fn(() => Promise.resolve());
    const signOutOthers = jest.fn(() => Promise.resolve({ revoked: 1, labels: ['phone'] }));
    const { result } = setup(
      () => ({ list: useSessions(), revoke: useRevokeSession(), others: useSignOutOthers() }),
      { listSessions, revokeSession, signOutOthers },
      'authenticated',
    );

    await waitFor(() => {
      expect(result.current.list.current?.id).toBe('here');
    });
    expect(result.current.list.others.map((s) => s.id)).toEqual(['phone']);

    act(() => {
      result.current.revoke.mutate('phone');
      result.current.others.mutate();
    });
    await waitFor(() => {
      expect(listSessions.mock.calls.length).toBeGreaterThan(1);
    });
    expect(revokeSession).toHaveBeenCalledWith('phone');
    expect(signOutOthers).toHaveBeenCalled();
  });

  it('loads the delete summary only when signed in', () => {
    const getMeSummary = jest.fn(() => new Promise<never>(() => undefined));
    setup(() => useMeSummary(), { getMeSummary });
    expect(getMeSummary).not.toHaveBeenCalled();
    setup(() => useMeSummary(), { getMeSummary }, 'authenticated');
    expect(getMeSummary).toHaveBeenCalled();
  });

  it('deletes the account only with the typed confirmation, then signs out', async () => {
    const deleteAccount = jest.fn(() => Promise.resolve({ purgeAt: 99 }));
    const { result, client } = setup(() => useDeleteAccount(), { deleteAccount }, 'authenticated');

    act(() => {
      result.current.submit({ password: 'a long phrase', confirm: 'delete' as never });
    });
    expect(result.current.fieldErrors).toEqual({ confirm: 'CONFIRMATION_MISMATCH' });

    act(() => {
      result.current.submit({ password: 'a long phrase', confirm: 'DELETE' });
    });
    await waitFor(() => {
      expect(result.current.purgeAt).toBe(99);
    });
    expect(client.auth.session.getState().status).toBe('guest');
  });

  it('resets the practice account and refetches everything personal', async () => {
    const selfReset = jest.fn(() => Promise.resolve({ account: {} as never }));
    const { result, queryClient } = setup(() => useSelfReset(), { selfReset }, 'authenticated');
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries');

    act(() => {
      result.current.submit({ confirm: 'RESET' });
    });

    await waitFor(() => {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: meKeys('u1').root });
    });
  });
});
