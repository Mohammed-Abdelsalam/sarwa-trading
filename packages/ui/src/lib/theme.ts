import { useSyncExternalStore } from 'react';

import { type ThemeName } from '@sarwa/tokens';

const DARK_QUERY = '(prefers-color-scheme: dark)';

const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  const media = window.matchMedia(DARK_QUERY);
  listeners.add(onChange);
  media.addEventListener('change', onChange);
  return () => {
    listeners.delete(onChange);
    media.removeEventListener('change', onChange);
  };
}

function currentTheme(): ThemeName {
  const classes = document.documentElement.classList;
  if (classes.contains('dark')) return 'dark';
  if (classes.contains('light')) return 'light';
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

// The theme lives on <html> (set before paint by each app's theme script) and is saved under storageKey.
export function useTheme(storageKey: string): { theme: ThemeName; toggle: () => void } {
  const theme = useSyncExternalStore(subscribe, currentTheme, (): ThemeName => 'dark');
  return {
    theme,
    toggle: () => {
      const next: ThemeName = theme === 'dark' ? 'light' : 'dark';
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(next);
      try {
        window.localStorage.setItem(storageKey, next);
      } catch {
        // Private mode: the choice still applies for this visit.
      }
      for (const listener of listeners) listener();
    },
  };
}
