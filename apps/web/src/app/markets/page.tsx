import { type Metadata } from 'next';
import { Suspense } from 'react';

import { MarketsPage } from '../../features/markets/markets-page';
import { serverCopy } from '../../lib/seo';

// Search and selection live in the query, so every variant points search engines at the bare list.
export async function generateMetadata(): Promise<Metadata> {
  const { t, m } = await serverCopy();
  return {
    title: t.markets.title,
    description: m.seo.marketsDescription,
    alternates: { canonical: '/markets' },
  };
}

// The stock list is prefetched in the root layout.
export default function Page() {
  return (
    <Suspense>
      <MarketsPage />
    </Suspense>
  );
}
