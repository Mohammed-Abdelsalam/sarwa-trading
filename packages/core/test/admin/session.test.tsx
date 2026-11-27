import { act, renderHook, waitFor } from '@testing-library/react';

import {
  LOGIN_ATTEMPTS,
  useAdminSession,
  useCanEdit,
  useLogin,
  useLogout,
} from '../../src/admin/session';
import { makeProblem } from '../utils';
import { createAdminWrapper, makeAdminUser } from './fixtures';

describe('useAdminSession', () => {
  it('exposes the role and whether the operator may edit', async () => {
    const { Wrapper } = createAdminWrapper({
      me: () => Promise.resolve(makeAdminUser({ role: 'VIEWER' })),
    });

    const { result } = renderHook(() => ({ session: useAdminSession(), canEdit: useCanEdit() }), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.session.isViewer).toBe(true);
    });
    expect(result.current.canEdit).toBe(false);
  });
});

describe('useLogin', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('stores the session and reports success', async () => {
    const user = makeAdminUser();
    const onSuccess = jest.fn();
    const { Wrapper, queryClient } = createAdminWrapper({ login: () => Promise.resolve(user) });
    const { result } = renderHook(() => useLogin({ onSuccess }), { wrapper: Wrapper });

    act(() => {
      result.current.submit({ email: user.email, password: 'password1', remember: true });
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(user);
    });
    expect(queryClient.getQueryData(['admin', 'session'])).toEqual(user);
  });

  it('counts failed attempts, then cools down for a minute', async () => {
    jest.useFakeTimers();
    const login = jest.fn(() => Promise.reject(makeProblem(401)));
    const { Wrapper } = createAdminWrapper({ login });
    const { result } = renderHook(() => useLogin(), { wrapper: Wrapper });
    const body = { email: 'a@b.co', password: 'password1' };

    for (let attempt = 1; attempt < LOGIN_ATTEMPTS; attempt += 1) {
      act(() => {
        result.current.submit(body);
      });
      await waitFor(() => {
        expect(result.current.attemptsLeft).toBe(LOGIN_ATTEMPTS - attempt);
      });
    }
    expect(result.current.error).toBe('invalid');

    act(() => {
      result.current.submit(body);
    });
    await waitFor(() => {
      expect(result.current.error).toBe('cooldown');
    });
    act(() => {
      jest.advanceTimersByTime(1_000);
    });
    expect(result.current.cooldownSeconds).toBe(59);

    act(() => {
      result.current.submit(body);
    });
    expect(login).toHaveBeenCalledTimes(LOGIN_ATTEMPTS);

    act(() => {
      jest.advanceTimersByTime(60_000);
    });
    await waitFor(() => {
      expect(result.current.error).toBeNull();
    });
    expect(result.current.attemptsLeft).toBe(LOGIN_ATTEMPTS);
  });

  it('cools down when the server throttles and reports outages', async () => {
    const login = jest
      .fn()
      .mockRejectedValueOnce(makeProblem(503))
      .mockRejectedValueOnce(makeProblem(429));
    const { Wrapper } = createAdminWrapper({ login });
    const { result } = renderHook(() => useLogin(), { wrapper: Wrapper });

    act(() => {
      result.current.submit({ email: 'a@b.co', password: 'password1' });
    });
    await waitFor(() => {
      expect(result.current.error).toBe('unavailable');
    });
    act(() => {
      result.current.submit({ email: 'a@b.co', password: 'password1' });
    });
    await waitFor(() => {
      expect(result.current.error).toBe('cooldown');
    });
  });
});

describe('useLogout', () => {
  it('drops the session even when the request fails', async () => {
    const { Wrapper, client, socket } = createAdminWrapper({
      logout: () => Promise.reject(new Error('offline')),
    });
    const { result } = renderHook(() => useLogout(), { wrapper: Wrapper });

    act(() => {
      result.current.logout();
    });

    await waitFor(() => {
      expect(client.toLogin).toHaveBeenCalled();
    });
    expect(socket.disconnect).toHaveBeenCalled();
  });
});
