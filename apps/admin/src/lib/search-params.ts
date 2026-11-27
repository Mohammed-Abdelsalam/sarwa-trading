import { useEffect, useRef, useState } from 'react';

import { SEARCH_DEBOUNCE_MS } from '@sarwa/core/admin';

export type ParamPatch = Record<string, string | number | null>;

// Native history entries: Next keeps useSearchParams in sync without a server round trip.
export function setSearchParams(patch: ParamPatch, mode: 'push' | 'replace' = 'push') {
  const params = new URLSearchParams(window.location.search);
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === '') params.delete(key);
    else params.set(key, String(value));
  }
  const query = params.toString();
  const url = `${window.location.pathname}${query ? `?${query}` : ''}`;
  if (mode === 'push') window.history.pushState(null, '', url);
  else window.history.replaceState(null, '', url);
}

export function oneOf<T extends string>(
  value: string | null,
  options: readonly T[],
  fallback: T,
): T {
  return options.find((option) => option === value) ?? fallback;
}

export function pageParam(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 1 ? page : 1;
}

// The box follows every keystroke; the URL (and the query built from it) follows once typing pauses.
export function useSearchParamText(params: URLSearchParams, key: string, reset: ParamPatch = {}) {
  const value = params.get(key) ?? '';
  const [text, setText] = useState(value);
  const [seen, setSeen] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
    },
    [],
  );
  // Back, Forward or a link changed the URL under the box.
  if (value !== seen) {
    setSeen(value);
    if (value !== text.trim()) setText(value);
  }

  return {
    text,
    value,
    set: (next: string) => {
      setText(next);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setSearchParams({ ...reset, [key]: next.trim() || null }, 'replace');
      }, SEARCH_DEBOUNCE_MS);
    },
    clear: (also: ParamPatch = {}) => {
      clearTimeout(timer.current);
      setText('');
      setSearchParams({ ...reset, ...also, [key]: null });
    },
  };
}
