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
