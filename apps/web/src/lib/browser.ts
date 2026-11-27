import { useSearchParams } from 'next/navigation';
import { useEffect, useEffectEvent, useSyncExternalStore } from 'react';

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

export function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  );
}

// A window keydown listener that always sees the latest render's handler.
export function useWindowKeyDown(handler: (event: KeyboardEvent) => void): void {
  const onKeyDown = useEffectEvent(handler);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      onKeyDown(event);
    };
    window.addEventListener('keydown', listener);
    return () => {
      window.removeEventListener('keydown', listener);
    };
  }, []);
}

const noSubscribe = () => () => undefined;

// "⌘" on Apple keyboards, "Ctrl" elsewhere; the server renders the Ctrl form.
export function useModKey(): string {
  return useSyncExternalStore(
    noSubscribe,
    () => (/Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘' : 'Ctrl'),
    () => 'Ctrl',
  );
}

export type NotificationPermissionState = NotificationPermission | 'unsupported';

const permissionListeners = new Set<() => void>();

function readPermission(): NotificationPermissionState {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
}

export function useNotificationPermission(): {
  permission: NotificationPermissionState;
  request: () => void;
} {
  const permission = useSyncExternalStore(
    (onChange) => {
      permissionListeners.add(onChange);
      return () => {
        permissionListeners.delete(onChange);
      };
    },
    readPermission,
    (): NotificationPermissionState => 'default',
  );
  return {
    permission,
    request: () => {
      if (typeof Notification === 'undefined') return;
      void Notification.requestPermission().then(() => {
        permissionListeners.forEach((listener) => {
          listener();
        });
      });
    },
  };
}
