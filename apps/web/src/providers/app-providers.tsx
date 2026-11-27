'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';

import {
  SarwaProvider,
  shouldRetry,
  useMarketConnection,
  useSyncStocksOnChange,
} from '@sarwa/core';

import { usePageLifecycle } from '../lib/browser';
import { createBrowserClient } from '../lib/client';

function LiveSync() {
  useMarketConnection(usePageLifecycle());
  useSyncStocksOnChange();
  return null;
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({ defaultOptions: { queries: { retry: shouldRetry, staleTime: 30_000 } } }),
  );
  const [client] = useState(createBrowserClient);

  return (
    <QueryClientProvider client={queryClient}>
      <SarwaProvider client={client}>
        <LiveSync />
        {children}
      </SarwaProvider>
    </QueryClientProvider>
  );
}
