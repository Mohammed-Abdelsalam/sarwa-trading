import { type Metadata } from 'next';
import { Suspense } from 'react';

import { PortfolioPage } from '../../features/portfolio/portfolio-page';

export const metadata: Metadata = { title: 'Portfolio' };

// The books belong to this browser's device id, so they are fetched on the client.
export default function Page() {
  return (
    <Suspense>
      <PortfolioPage />
    </Suspense>
  );
}
