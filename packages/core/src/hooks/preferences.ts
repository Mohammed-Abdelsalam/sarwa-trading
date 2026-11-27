import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useSarwa } from '../provider';
import { queryKeys } from './keys';

// Storage is async on mobile, so the value comes through React Query; isLoaded lets a screen wait for
// the saved choice instead of rendering the default first and then jumping.
export function usePreference<T extends string>(key: string, allowed: readonly T[], fallback: T) {
  const { storage } = useSarwa();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.preference(key),
    queryFn: () => storage.getItem(key),
    staleTime: Infinity,
    retry: false,
  });

  const setValue = useCallback(
    (value: T) => {
      queryClient.setQueryData(queryKeys.preference(key), value);
      storage.setItem(key, value).catch(() => undefined);
    },
    [queryClient, storage, key],
  );

  return {
    value: allowed.find((option) => option === query.data) ?? fallback,
    isLoaded: !query.isPending,
    setValue,
  };
}

function parseList(raw: string | null | undefined): string[] {
  try {
    const value: unknown = JSON.parse(raw ?? '[]');
    return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

// A most-recent-first list kept in device storage, e.g. recent searches.
export function useStoredList(key: string, max: number) {
  const { storage } = useSarwa();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.preference(key),
    queryFn: () => storage.getItem(key),
    staleTime: Infinity,
    retry: false,
  });
  const list = parseList(query.data);
  const save = (next: string[]) => {
    const raw = JSON.stringify(next);
    queryClient.setQueryData(queryKeys.preference(key), raw);
    storage.setItem(key, raw).catch(() => undefined);
  };
  return {
    list,
    add: (item: string) => {
      save([item, ...list.filter((entry) => entry !== item)].slice(0, max));
    },
    clear: () => {
      save([]);
    },
  };
}
