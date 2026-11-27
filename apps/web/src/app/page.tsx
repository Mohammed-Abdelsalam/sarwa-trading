import { type Metadata } from 'next';
import { Suspense } from 'react';

import { HomePage } from '../features/home/home-page';

export const metadata: Metadata = { alternates: { canonical: '/' } };

// The stock list is prefetched in the root layout.
export default function Page() {
  return (
    <Suspense>
      <HomePage />
    </Suspense>
  );
}
