import { onlineManager } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';

import { meKeys, queryKeys } from '../../src/hooks/keys';
import { usePortfolio } from '../../src/hooks/portfolio';
import { useAuthSync, usePrivateScope, useSession } from '../../src/hooks/session';
import { type TradingEventListener } from '../../src/market-socket';
import { makePortfolio } from '../trading-fixtures';
import { createAuthClient, createTestClient, createWrapper, makeProblem, makeUser } from '../utils';

const SUSPENSION = {
  reasonCategory: 'fraud' as const,
  reason: 'Suspicious activity on the account',
  at: 7,
  accountHandle: 'ACC-7F2A9C',
};

function withEvents<T extends ReturnType<typeof createAuthClient>>(client: T) {
  const listeners = new Set<TradingEventListener>();
  client.market.onTradingEvent = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  return {
    client,
    emit: (event: Parameters<TradingEventListener>[0]) => {
      listeners.forEach((listener) => {
        listener(event);
      });
    },
  };
}

describe('useAuthSync', () => {
  it('restores a stored session at launch', async () => {
    const getMe = jest.fn(() => Promise.resolve(makeUser()));
    const client = createAuthClient({ getMe }, { status: 'loading' });
    const { Wrapper } = createWrapper(client);

    renderHook(() => useAuthSync(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(client.auth.session.getState().status).toBe('authenticated');
    });
    expect(client.auth.session.getState().user?.id).toBe('u1');
  });

  it('settles a first launch as a guest without asking the server', async () => {
    const getMe = jest.fn();
    const client = createAuthClient({ getMe }, { status: 'loading' });
    client.auth.transport.hasCredentials.mockResolvedValue(false);
    const { Wrapper } = createWrapper(client);

    renderHook(() => useAuthSync(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(client.auth.session.getState().status).toBe('guest');
    });
    expect(getMe).not.toHaveBeenCalled();
  });

  it('becomes a guest when the server no longer knows the session', async () => {
    const client = createAuthClient(
      { getMe: () => Promise.reject(makeProblem(401)) },
      { status: 'loading' },
    );
    const { Wrapper } = createWrapper(client);

    renderHook(() => useAuthSync(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(client.auth.session.getState().status).toBe('guest');
    });
    expect(client.auth.transport.clear).toHaveBeenCalled();
  });

  it('signs out when the server forbids the session at launch', async () => {
    const client = createAuthClient(
      { getMe: () => Promise.reject(makeProblem(403)) },
      { status: 'loading' },
    );
    const { Wrapper } = createWrapper(client);

    renderHook(() => useAuthSync(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(client.auth.session.getState().status).toBe('guest');
    });
    expect(client.auth.transport.clear).toHaveBeenCalled();
  });

  it.each([500, 503, 429])(
    'opens as the saved user when `me` fails with %i, keeping the tokens until it answers',
    async (status) => {
      const fresh = makeUser({ name: 'Sara H' });
      const getMe = jest.fn().mockRejectedValueOnce(makeProblem(status)).mockResolvedValue(fresh);
      const client = createAuthClient({ getMe }, { status: 'loading' });
      const saved = makeUser();
      client.auth.transport.savedUser.mockResolvedValue(saved);
      const { Wrapper } = createWrapper(client);

      renderHook(() => useAuthSync(), { wrapper: Wrapper });

      await waitFor(() => {
        expect(client.auth.session.getState()).toMatchObject({
          status: 'authenticated',
          user: saved,
        });
      });
      expect(client.auth.transport.clear).not.toHaveBeenCalled();
      await waitFor(
        () => {
          expect(client.auth.session.getState().user).toEqual(fresh);
        },
        { timeout: 3_000 },
      );
      expect(client.auth.transport.clear).not.toHaveBeenCalled();
    },
  );

  describe('offline at launch', () => {
    const NETWORK = new TypeError('Network request failed');

    afterEach(() => {
      onlineManager.setOnline(true);
    });

    it('opens as the saved user, then confirms them once the network returns', async () => {
      const fresh = makeUser({ name: 'Sara H' });
      const getMe = jest.fn(() => Promise.resolve(fresh));
      const client = createAuthClient({ getMe }, { status: 'loading' });
      const saved = makeUser();
      client.auth.transport.savedUser.mockResolvedValue(saved);
      const { Wrapper } = createWrapper(client);
      onlineManager.setOnline(false);

      renderHook(() => useAuthSync(), { wrapper: Wrapper });

      await waitFor(() => {
        expect(client.auth.session.getState()).toMatchObject({
          status: 'authenticated',
          user: saved,
        });
      });
      expect(getMe).not.toHaveBeenCalled();

      act(() => {
        onlineManager.setOnline(true);
      });
      await waitFor(() => {
        expect(client.auth.session.getState().user).toEqual(fresh);
      });
      expect(client.auth.transport.clear).not.toHaveBeenCalled();
    });

    it('browses as a guest without a saved user, keeping the tokens until the server answers', async () => {
      const getMe = jest.fn().mockRejectedValueOnce(NETWORK).mockResolvedValue(makeUser());
      const client = createAuthClient({ getMe }, { status: 'loading' });
      const { Wrapper } = createWrapper(client);

      renderHook(() => useAuthSync(), { wrapper: Wrapper });

      await waitFor(() => {
        expect(client.auth.session.getState().status).toBe('guest');
      });
      expect(client.auth.transport.clear).not.toHaveBeenCalled();
      await waitFor(
        () => {
          expect(client.auth.session.getState().status).toBe('authenticated');
        },
        { timeout: 3_000 },
      );
    });

    it('signs out when the server, reached again, no longer knows the session', async () => {
      const getMe = jest.fn().mockRejectedValueOnce(NETWORK).mockRejectedValue(makeProblem(401));
      const client = createAuthClient({ getMe }, { status: 'loading' });
      client.auth.transport.savedUser.mockResolvedValue(makeUser());
      const { Wrapper } = createWrapper(client);

      renderHook(() => useAuthSync(), { wrapper: Wrapper });

      await waitFor(() => {
        expect(client.auth.session.getState().status).toBe('authenticated');
      });
      await waitFor(
        () => {
          expect(client.auth.session.getState()).toMatchObject({
            status: 'guest',
            revokedReason: 'expired',
          });
        },
        { timeout: 3_000 },
      );
      expect(client.auth.transport.clear).toHaveBeenCalled();
    });
  });

  it('drops only personal data on an identity change and rejoins the socket', () => {
    const client = createAuthClient({}, { status: 'authenticated' });
    client.store.getState().setConnection({ status: 'open' });
    const { Wrapper, queryClient } = createWrapper(client);
    const keys = meKeys('u1');
    queryClient.setQueryData(keys.portfolio, { cash: 1 });
    queryClient.setQueryData(queryKeys.preference('sarwa.locale'), 'ar');
    queryClient.setQueryData(queryKeys.stocks, []);
    const onIdentityChange = jest.fn();

    renderHook(() => useAuthSync({ onIdentityChange }), { wrapper: Wrapper });
    act(() => {
      client.auth.session.getState().signOut();
    });

    expect(queryClient.getQueryData(keys.portfolio)).toBeUndefined();
    expect(queryClient.getQueryData(queryKeys.preference('sarwa.locale'))).toBe('ar');
    expect(queryClient.getQueryData(queryKeys.stocks)).toEqual([]);
    expect(client.market.disconnect).toHaveBeenCalledTimes(1);
    expect(client.market.connect).toHaveBeenCalledTimes(1);
    expect(onIdentityChange).toHaveBeenCalledWith(null);

    act(() => {
      client.auth.session.getState().signIn(makeUser({ id: 'u2' }));
    });
    expect(onIdentityChange).toHaveBeenLastCalledWith('u2');
  });

  it('leaves a socket the app has closed alone', () => {
    const client = createAuthClient({}, { status: 'authenticated' });
    client.store.getState().setConnection({ status: 'offline' });
    const { Wrapper } = createWrapper(client);

    renderHook(() => useAuthSync(), { wrapper: Wrapper });
    act(() => {
      client.auth.session.getState().signOut();
    });

    expect(client.market.connect).not.toHaveBeenCalled();
  });

  it('signs out, or shows the suspension, when the server revokes the session', async () => {
    const { client, emit } = withEvents(createAuthClient({}, { status: 'authenticated' }));
    const { Wrapper } = createWrapper(client);
    renderHook(() => useAuthSync(), { wrapper: Wrapper });

    act(() => {
      emit({ name: 'session.revoked', payload: { v: 1, reason: 'password_changed' } });
    });
    await waitFor(() => {
      expect(client.auth.session.getState()).toMatchObject({
        status: 'guest',
        revokedReason: 'password_changed',
      });
    });

    act(() => {
      emit({
        name: 'session.revoked',
        payload: { v: 1, reason: 'suspended', suspension: SUSPENSION },
      });
    });
    await waitFor(() => {
      expect(client.auth.session.getState()).toMatchObject({
        status: 'suspended',
        suspension: SUSPENSION,
      });
    });
  });

  it('does nothing without customer auth', () => {
    const client = createTestClient();
    const { Wrapper } = createWrapper(client);
    renderHook(() => useAuthSync(), { wrapper: Wrapper });
    expect(client.market.onTradingEvent).not.toHaveBeenCalled();
  });
});

describe('useSession and usePrivateScope', () => {
  it('treat the device as signed in when customer auth is not wired', () => {
    const { Wrapper } = createWrapper(createTestClient());
    const { result } = renderHook(() => ({ session: useSession(), scope: usePrivateScope() }), {
      wrapper: Wrapper,
    });

    expect(result.current.session).toMatchObject({ status: 'authenticated', isGuest: false });
    expect(result.current.scope.enabled).toBe(true);
    expect(result.current.scope.keys.root).toEqual(['me', 'device']);
  });

  it('let a suspended customer dismiss the screen and browse as a guest', () => {
    const client = createAuthClient();
    client.auth.session.getState().suspend(SUSPENSION);
    const { Wrapper } = createWrapper(client);
    const { result } = renderHook(() => useSession(), { wrapper: Wrapper });
    expect(result.current).toMatchObject({ status: 'suspended', isGuest: true });

    act(() => {
      result.current.acknowledge();
    });

    expect(result.current).toMatchObject({ status: 'guest', suspension: null });
  });

  it('load personal data for a signed-in customer under their own key', async () => {
    const books = makePortfolio();
    const getPortfolio = jest.fn(() => Promise.resolve(books));
    const { Wrapper, queryClient } = createWrapper(
      createAuthClient({ getPortfolio }, { status: 'authenticated' }),
    );
    const { result } = renderHook(() => usePortfolio(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.books).toEqual(books);
    });
    expect(queryClient.getQueryData(meKeys('u1').portfolio)).toEqual(books);
  });

  it('never fetch personal data for a guest', () => {
    const getPortfolio = jest.fn();
    const { Wrapper } = createWrapper(createAuthClient({ getPortfolio }));
    const { result } = renderHook(() => usePortfolio(), { wrapper: Wrapper });

    expect(result.current.isLoading).toBe(false);
    expect(getPortfolio).not.toHaveBeenCalled();
  });
});
