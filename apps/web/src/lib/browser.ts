import { useSearchParams } from 'next/navigation';
import { useEffect, useSyncExternalStore } from 'react';

function subscribeVisibility(onChange: () => void) {
  document.addEventListener('visibilitychange', onChange);
  return () => {
    document.removeEventListener('visibilitychange', onChange);
  };
}

function subscribeOnline(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

export function usePageLifecycle(): { foreground: boolean; online: boolean } {
  const foreground = useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState === 'visible',
    () => true,
  );
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
  return { foreground, online };
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => {
        list.removeEventListener('change', onChange);
      };
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

const urlListeners = new Set<() => void>();

function notifyUrlListeners() {
  urlListeners.forEach((listener) => {
    listener();
  });
}

function subscribeUrl(onChange: () => void) {
  urlListeners.add(onChange);
  window.addEventListener('popstate', onChange);
  return () => {
    urlListeners.delete(onChange);
    window.removeEventListener('popstate', onChange);
  };
}

// Next applies replaceState inside a transition, so a controlled input bound to useSearchParams drops
// keystrokes; reading the URL directly updates in the same render, while the server still uses Next's value.
export function useSearchParam(name: string): string | null {
  const fromNext = useSearchParams().get(name);
  // Next writes the URL after its commit, so re-read once its params change (router.push, back/forward).
  useEffect(notifyUrlListeners, [fromNext]);
  return useSyncExternalStore(
    subscribeUrl,
    () => new URLSearchParams(window.location.search).get(name),
    () => fromNext,
  );
}

// Writes a query param without a server round trip.
export function replaceSearchParam(name: string, value: string | null): void {
  const url = new URL(window.location.href);
  if (value) url.searchParams.set(name, value);
  else url.searchParams.delete(name);
  // null, not history.state: Next treats a call carrying its own state (__NA) as internal and skips the sync.
  window.history.replaceState(null, '', url);
  notifyUrlListeners();
}

// Per-viewer UI preferences (e.g. table vs grid). Storage can be blocked, so a memory copy backs it.
const memory = new Map<string, string>();
const listeners = new Set<() => void>();

function subscribePreferences(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}

function readPreference(key: string): string | null {
  try {
    return window.localStorage.getItem(key) ?? memory.get(key) ?? null;
  } catch {
    return memory.get(key) ?? null;
  }
}

export function useLocalPreference<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T,
): [T, (value: T) => void] {
  const saved = useSyncExternalStore(
    subscribePreferences,
    () => readPreference(key),
    () => null,
  );
  const value = allowed.find((option) => option === saved) ?? fallback;
  const setValue = (next: T) => {
    memory.set(key, next);
    try {
      window.localStorage.setItem(key, next);
    } catch {
      // Storage unavailable: the memory copy still applies for this visit.
    }
    listeners.forEach((listener) => {
      listener();
    });
  };
  return [value, setValue];
}
