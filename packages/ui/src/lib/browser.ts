import { useSyncExternalStore } from 'react';

import { type KeyValueStorage } from '@sarwa/core/pure';

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

// localStorage behind the async storage interface; blocked storage (private mode) reads as empty.
export const safeLocalStorage: KeyValueStorage = {
  getItem: (key) => {
    try {
      return Promise.resolve(window.localStorage.getItem(key));
    } catch {
      return Promise.resolve(null);
    }
  },
  setItem: (key, value) => {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Private mode: the value lasts for this visit only.
    }
    return Promise.resolve();
  },
};

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
