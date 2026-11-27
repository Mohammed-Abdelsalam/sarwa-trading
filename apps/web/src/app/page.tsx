import { Suspense } from 'react';

import { HomePage } from '../features/home/home-page';

// The stock list is prefetched in the root layout.
export default function Page() {
  return (
    <Suspense>
      <HomePage />
    </Suspense>
  );
}
