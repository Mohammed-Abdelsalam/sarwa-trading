import { AUTH_TTL_MS, type AuthSessionResponse } from '@sarwa/contracts';

import { ApiError } from '../../src/api';
import {
  type ClientAuth,
  createGateStore,
  createIntentStorage,
  createSessionAuth,
  createSessionStore,
  endSession,
  startSession,
} from '../../src/auth/session';
import { type AuthTransport } from '../../src/auth/transport';
import { createMemoryStorage, makeProblem, makeUser } from '../utils';

const SUSPENSION = {
  reasonCategory: 'abuse' as const,
  reason: 'Automated trading scripts',
  at: 5,
  accountHandle: 'ACC-7F2A9C',
};

function fakeTransport(refreshBody: AuthTransport['refreshBody'] = () => Promise.resolve({})) {
  return {
    platform: 'web',
    headers: jest.fn(() => Promise.resolve({ 'x-test': '1' })),
    hasCredentials: () => Promise.resolve(true),
    refreshBody: jest.fn(refreshBody),
    save: jest.fn(() => Promise.resolve()),
    clear: jest.fn(() => Promise.resolve()),
    socketToken: () => Promise.resolve(undefined),
  } satisfies AuthTransport;
}

function makeAuth(transport = fakeTransport()): ClientAuth & { transport: typeof transport } {
  return {
    transport,
    session: createSessionStore(),
    gate: createGateStore(),
    intents: createIntentStorage(createMemoryStorage()),
  };
}

const settle = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

const session = (overrides: Partial<AuthSessionResponse> = {}): AuthSessionResponse => ({
  user: makeUser(),
  accessExpiresAt: 1,
  ...overrides,
});

describe('session store', () => {
  it('starts loading, then follows sign-in, profile edits, sign-out and dismissal', () => {
    const store = createSessionStore();
    expect(store.getState()).toMatchObject({ status: 'loading', user: null });

    store.getState().signIn(makeUser());
    store.getState().update(makeUser({ name: 'Sara A' }));
    store.getState().update(makeUser({ id: 'someone-else', name: 'Mallory' }));
    expect(store.getState()).toMatchObject({ status: 'authenticated', user: { name: 'Sara A' } });

    store.getState().signOut('password_changed');
    expect(store.getState()).toMatchObject({
      status: 'guest',
      user: null,
      revokedReason: 'password_changed',
    });

    store.getState().acknowledge();
    expect(store.getState()).toMatchObject({ status: 'guest', revokedReason: null });
  });

  it('keeps the suspension for the suspended screen until it is dismissed', () => {
    const store = createSessionStore();
    store.getState().signIn(makeUser());

    store.getState().suspend(SUSPENSION);
    expect(store.getState()).toMatchObject({
      status: 'suspended',
      user: null,
      suspension: SUSPENSION,
    });

    store.getState().acknowledge();
    expect(store.getState()).toMatchObject({ status: 'guest', suspension: null });
  });
});

describe('intent storage', () => {
  it('hands back a fresh intent once', async () => {
    let now = 1_000;
    const intents = createIntentStorage(createMemoryStorage(), () => now);
    await intents.save({ kind: 'alert', symbol: 'AAPL' });
    now += AUTH_TTL_MS.authIntent;

    await expect(intents.take()).resolves.toEqual({ kind: 'alert', symbol: 'AAPL' });
    await expect(intents.take()).resolves.toBeNull();
  });

  it('drops an intent older than ten minutes, or one it cannot read', async () => {
    let now = 1_000;
    const storage = createMemoryStorage();
    const intents = createIntentStorage(storage, () => now);
    await intents.save({ kind: 'order', symbol: 'AAPL', side: 'buy' });
    now += AUTH_TTL_MS.authIntent + 1;
    await expect(intents.take()).resolves.toBeNull();

    await storage.setItem('sarwa.authIntent', '{not json');
    await expect(intents.take()).resolves.toBeNull();
    await storage.setItem('sarwa.authIntent', JSON.stringify({ intent: { kind: 'x' }, at: now }));
    await expect(intents.take()).resolves.toBeNull();
  });

  it('drops a star saved before guests could star without an account', async () => {
    const storage = createMemoryStorage();
    const intents = createIntentStorage(storage, () => 1_000);
    const star = { intent: { kind: 'watch', symbol: 'AAPL' }, at: 1_000 };
    await storage.setItem('sarwa.authIntent', JSON.stringify(star));

    await expect(intents.take()).resolves.toBeNull();
  });
});

describe('gate store', () => {
  it('opens with the intent and closes', () => {
    const gate = createGateStore();
    gate.getState().open({ kind: 'portfolio' });
    expect(gate.getState()).toMatchObject({ isOpen: true, intent: { kind: 'portfolio' } });
    gate.getState().close();
    expect(gate.getState().isOpen).toBe(false);
  });
});

describe('startSession and endSession', () => {
  it('keeps the tokens, signs in and closes the gate', async () => {
    const auth = makeAuth();
    auth.gate.getState().open({ kind: 'orders' });

    await startSession(auth, session());

    expect(auth.transport.save).toHaveBeenCalledWith(session());
    expect(auth.session.getState().status).toBe('authenticated');
    expect(auth.gate.getState().isOpen).toBe(false);
  });

  it('forgets the tokens and leaves a guest, or a suspended customer', async () => {
    const auth = makeAuth();
    await startSession(auth, session());

    await endSession(auth, 'revoked');
    expect(auth.transport.clear).toHaveBeenCalled();
    expect(auth.session.getState()).toMatchObject({ status: 'guest', revokedReason: 'revoked' });

    await endSession(auth, 'suspended', SUSPENSION);
    expect(auth.session.getState().status).toBe('suspended');
  });
});

describe('createSessionAuth', () => {
  it('passes the transport headers and credentials through', async () => {
    const auth = makeAuth();
    const requestAuth = createSessionAuth({ auth, refreshSession: jest.fn() });

    await expect(requestAuth.headers?.({ method: 'GET' })).resolves.toEqual({ 'x-test': '1' });
    expect(auth.transport.headers).toHaveBeenCalledWith({ method: 'GET' });
  });

  it('shares one refresh between concurrent 401s and stores the rotated session', async () => {
    const auth = makeAuth();
    auth.session.getState().signIn(makeUser());
    let finish: (value: AuthSessionResponse) => void = () => undefined;
    const refreshSession = jest.fn(
      () =>
        new Promise<AuthSessionResponse>((resolve) => {
          finish = resolve;
        }),
    );
    const requestAuth = createSessionAuth({ auth, refreshSession });

    const first = requestAuth.refresh?.();
    const second = requestAuth.refresh?.();
    await Promise.resolve();
    finish(session({ user: makeUser({ emailVerified: true }) }));

    await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(auth.transport.save).toHaveBeenCalledTimes(1);
    expect(auth.session.getState().user?.emailVerified).toBe(true);

    refreshSession.mockResolvedValueOnce(session());
    await requestAuth.refresh?.();
    expect(refreshSession).toHaveBeenCalledTimes(2);
  });

  it('reports each successful renewal once, after the new session is saved', async () => {
    const auth = makeAuth();
    const onRenewed = jest.fn(() => {
      expect(auth.transport.save).toHaveBeenCalled();
    });
    const refreshSession = jest
      .fn<Promise<AuthSessionResponse>, []>()
      .mockResolvedValueOnce(session())
      .mockRejectedValueOnce(makeProblem(503))
      .mockRejectedValueOnce(makeProblem(401));
    const requestAuth = createSessionAuth({ auth, refreshSession, onRenewed });

    await Promise.all([requestAuth.refresh?.(), requestAuth.refresh?.()]);
    await requestAuth.refresh?.().catch(() => undefined);
    await requestAuth.refresh?.();

    expect(onRenewed).toHaveBeenCalledTimes(1);
  });

  it('cannot renew without a refresh token, or when the server refuses it', async () => {
    const empty = makeAuth(fakeTransport(() => Promise.resolve(null)));
    const refreshSession = jest.fn(() => Promise.reject(makeProblem(401)));
    await expect(createSessionAuth({ auth: empty, refreshSession }).refresh?.()).resolves.toBe(
      false,
    );
    expect(refreshSession).not.toHaveBeenCalled();

    const refused = makeAuth();
    await expect(createSessionAuth({ auth: refused, refreshSession }).refresh?.()).resolves.toBe(
      false,
    );
  });

  it('keeps the session through a network failure while renewing', async () => {
    const auth = makeAuth();
    const offline = new TypeError('Network request failed');
    const requestAuth = createSessionAuth({
      auth,
      refreshSession: () => Promise.reject(offline),
    });

    await expect(requestAuth.refresh?.()).rejects.toBe(offline);
    expect(auth.transport.clear).not.toHaveBeenCalled();
  });

  it('ends a signed-in session as expired, and settles a launch as a plain guest', async () => {
    const auth = makeAuth();
    const requestAuth = createSessionAuth({ auth, refreshSession: jest.fn() });

    requestAuth.onUnauthorized?.();
    await settle();
    expect(auth.session.getState()).toMatchObject({ status: 'guest', revokedReason: null });

    auth.session.getState().signIn(makeUser());
    requestAuth.onUnauthorized?.();
    await settle();
    expect(auth.session.getState()).toMatchObject({ status: 'guest', revokedReason: 'expired' });

    requestAuth.onUnauthorized?.();
    await settle();
    expect(auth.session.getState().revokedReason).toBe('expired');
  });

  it('treats a revoked or forbidden refresh as the end of the session', async () => {
    const auth = makeAuth();
    const problem = new ApiError({
      type: 'about:blank',
      title: 'Revoked',
      status: 401,
      code: 'SESSION_REVOKED',
    });
    await expect(
      createSessionAuth({ auth, refreshSession: () => Promise.reject(problem) }).refresh?.(),
    ).resolves.toBe(false);
    const forbidden = () => Promise.reject(makeProblem(403));
    await expect(createSessionAuth({ auth, refreshSession: forbidden }).refresh?.()).resolves.toBe(
      false,
    );
  });

  it.each([500, 503, 429])('keeps the session when the refresh fails with %i', async (status) => {
    const auth = makeAuth();
    auth.session.getState().signIn(makeUser());
    const problem = makeProblem(status);

    await expect(
      createSessionAuth({ auth, refreshSession: () => Promise.reject(problem) }).refresh?.(),
    ).rejects.toBe(problem);
    expect(auth.transport.clear).not.toHaveBeenCalled();
    expect(auth.session.getState().status).toBe('authenticated');
  });
});
