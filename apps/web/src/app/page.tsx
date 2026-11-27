import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import { connection } from 'next/server';
import { Suspense } from 'react';

import { queryKeys } from '@sarwa/core/server';

import { MarketsPage } from '../features/markets/markets-page';
import { getStocks } from '../lib/server-api';

export default async function Page() {
  // Prices change every tick, so render per request instead of freezing a build-time snapshot.
  await connection();
  const queryClient = new QueryClient();
  // Render the list on the server for a fast first paint; if the API is down the client retries.
  await queryClient
    .query({ queryKey: queryKeys.stocks, queryFn: getStocks })
    .catch(() => undefined);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense>
        <MarketsPage />
      </Suspense>
    </HydrationBoundary>
  );
}
