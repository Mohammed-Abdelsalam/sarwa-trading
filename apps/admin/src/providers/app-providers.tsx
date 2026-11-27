'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';

import { SarwaProvider, shouldRetry, useMarketConnection } from '@sarwa/core';
import { AdminProvider } from '@sarwa/core/admin';

import { usePageLifecycle } from '../lib/browser';
import { createBrowserClients } from '../lib/client';

function LiveSync() {
  useMarketConnection(usePageLifecycle());
  return null;
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({ defaultOptions: { queries: { retry: shouldRetry, staleTime: 15_000 } } }),
  );
  const [clients] = useState(createBrowserClients);

  return (
    <QueryClientProvider client={queryClient}>
      <SarwaProvider client={clients.sarwa}>
        <AdminProvider client={clients.admin}>
          <LiveSync />
          {children}
        </AdminProvider>
      </SarwaProvider>
    </QueryClientProvider>
  );
}
