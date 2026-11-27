import { type Metadata } from 'next';
import { Suspense } from 'react';

import { MarketsPage } from '../../features/markets/markets-page';

export const metadata: Metadata = { title: 'Markets' };

// The stock list is prefetched in the root layout.
export default function Page() {
  return (
    <Suspense>
      <MarketsPage />
    </Suspense>
  );
}
