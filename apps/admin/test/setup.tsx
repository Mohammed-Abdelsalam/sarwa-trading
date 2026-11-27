import { type AnchorHTMLAttributes } from 'react';

import type * as ReactModule from 'react';

// next/link needs the App Router context, which jsdom doesn't have; a plain anchor keeps href and a11y,
// and a click moves the history entry like a client-side navigation.
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    href,
    children,
    onClick,
    scroll: _scroll,
    prefetch: _prefetch,
    ...props
  }: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string | { pathname: string };
    scroll?: boolean;
    prefetch?: boolean;
  }) => {
    const path = typeof href === 'string' ? href : href.pathname;
    return (
      <a
        href={path}
        onClick={(event) => {
          onClick?.(event);
          event.preventDefault();
          window.history.pushState(null, '', path);
        }}
        {...props}
      >
        {children}
      </a>
    );
  },
}));

// Radix measures popovers and sliders; jsdom has no layout, so a no-op observer is enough.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverStub;

// The URL lives in jsdom's history, so pushState, replaceState and back() re-render like Next's router.
jest.mock('next/navigation', () => {
  const { useMemo, useSyncExternalStore } = jest.requireActual<typeof ReactModule>('react');
  const listeners = new Set<() => void>();
  const notify = () => {
    listeners.forEach((listener) => {
      listener();
    });
  };
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = window.history[method].bind(window.history);
    window.history[method] = (...args: Parameters<History['pushState']>) => {
      original(...args);
      notify();
    };
  }
  window.addEventListener('popstate', notify);
  const router = { replace: jest.fn(), push: jest.fn(), refresh: jest.fn() };
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  return {
    // One router for the whole file, so a test reads what a page pushed through useRouter().
    useRouter: () => router,
    usePathname: () => useSyncExternalStore(subscribe, () => window.location.pathname),
    useSearchParams: () => {
      const search = useSyncExternalStore(subscribe, () => window.location.search);
      return useMemo(() => new URLSearchParams(search), [search]);
    },
  };
});

beforeEach(() => {
  if (typeof window !== 'undefined') window.history.replaceState(null, '', '/overview');
});
