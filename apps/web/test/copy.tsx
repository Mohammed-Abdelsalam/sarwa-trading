import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { type ReactNode } from 'react';

import { type ClientAuth, queryKeys, SarwaProvider } from '@sarwa/core';

import { type Copy, useCopy } from '../src/lib/i18n';
import { createTestClient } from './fixtures';

export function providers({
  api = {},
  auth,
  locale,
  digits,
}: {
  api?: Parameters<typeof createTestClient>[0];
  auth?: ClientAuth;
  locale?: 'en' | 'ar';
  digits?: 'latn' | 'arab';
} = {}) {
  const client = createTestClient(api, auth);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (locale) queryClient.setQueryData(queryKeys.preference('sarwa.locale'), locale);
  if (digits) queryClient.setQueryData(queryKeys.preference('sarwa.digits'), digits);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <SarwaProvider client={client}>{children}</SarwaProvider>
    </QueryClientProvider>
  );
  return { client, queryClient, wrapper };
}

// The real catalogs and formatter, so component tests read the same copy users see.
export function testCopy(options: Parameters<typeof providers>[0] = {}): Copy {
  const { wrapper } = providers(options);
  return renderHook(() => useCopy(), { wrapper }).result.current;
}
