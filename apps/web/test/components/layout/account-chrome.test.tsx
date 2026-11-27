import { act, renderHook, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';

import { type ApiClient, type ClientAuth } from '@sarwa/core';

import { ToastHost } from '../../../src/components/layout/toast-host';
import { useAccountMenu } from '../../../src/components/layout/use-account-menu';
import { useNotificationCenter } from '../../../src/components/layout/use-notification-center';
import { useTopNav } from '../../../src/components/layout/use-top-nav';
import { AuthUiProvider } from '../../../src/features/gating/auth-ui';
import { useSettingsPage } from '../../../src/features/settings/use-settings-page';
import { providers } from '../../copy';
import { makeUser, testAuth } from '../../fixtures';

const router = { push: jest.fn(), replace: jest.fn(), refresh: jest.fn() };
jest.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

beforeAll(() => {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }) as unknown as MediaQueryList;
});

function accounts(auth: ClientAuth, api: Partial<ApiClient> = {}) {
  const base = providers({ api, auth });
  return function Accounts({ children }: { children: ReactNode }) {
    return (
      <base.wrapper>
        <ToastHost>
          <AuthUiProvider>{children}</AuthUiProvider>
        </ToastHost>
      </base.wrapper>
    );
  };
}

describe('account chrome', () => {
  it('gives a guest the gate from the bell, on the tab they chose', () => {
    const auth = testAuth();
    const { result } = renderHook(() => useTopNav(), { wrapper: accounts(auth) });
    expect(result.current.account).toBe('guest');

    act(() => {
      result.current.guest.onSignIn();
    });
    expect(auth.gate.getState()).toMatchObject({
      isOpen: true,
      intent: { kind: 'notifications' },
    });
    act(() => {
      result.current.guest.onCreate();
    });
    expect(auth.gate.getState().isOpen).toBe(true);
  });

  it('holds both control sets back while the session loads', () => {
    const { result } = renderHook(() => useTopNav(), {
      wrapper: accounts(testAuth({ status: 'loading' })),
    });
    expect(result.current.account).toBeNull();
  });

  it('opens the inbox once for a guest who signed in from the bell', async () => {
    const auth = testAuth();
    await auth.intents.save({ kind: 'notifications' });
    const listNotifications = jest.fn().mockResolvedValue({ items: [], nextCursor: null });
    const { result } = renderHook(() => useNotificationCenter(), {
      wrapper: accounts(auth, { listNotifications }),
    });
    expect(result.current.open).toBe(false);

    act(() => {
      auth.session.getState().signIn(makeUser());
    });
    await waitFor(() => {
      expect(result.current.open).toBe(true);
    });
    act(() => {
      result.current.setOpen(false);
    });
    expect(result.current.open).toBe(false);
    expect(auth.gate.getState().resumed).toBeNull();
  });

  it('signs out from the account menu, even when the server is unreachable', async () => {
    const auth = testAuth({ user: makeUser() });
    const signOut = jest.fn().mockRejectedValue(new TypeError('offline'));
    const { result } = renderHook(() => useAccountMenu(), {
      wrapper: accounts(auth, { signOut }),
    });
    expect(result.current.user).toEqual({ name: 'Sara Hassan', email: 'sara.h@example.com' });

    act(() => {
      result.current.actions.signOut();
    });
    await waitFor(() => {
      expect(auth.session.getState().status).toBe('guest');
    });
  });
});

describe.each([
  ['account menu', () => useAccountMenu().actions.setLocale],
  ['settings page', () => useSettingsPage().actions.setLocale],
])('switching language from the %s', (_name, useSetLocale) => {
  it('writes the cookie, then refreshes the server-rendered copy', () => {
    const cookie = jest.spyOn(document, 'cookie', 'set');
    router.refresh.mockClear();
    const { result } = renderHook(useSetLocale, { wrapper: accounts(testAuth()) });

    act(() => {
      result.current('ar');
    });

    const write = cookie.mock.calls.findIndex(([value]) => value.startsWith('sarwa.locale=ar;'));
    expect(write).toBeGreaterThanOrEqual(0);
    expect(router.refresh).toHaveBeenCalledTimes(1);
    expect(cookie.mock.invocationCallOrder[write]).toBeLessThan(
      router.refresh.mock.invocationCallOrder[0] ?? 0,
    );
    cookie.mockRestore();
  });
});
