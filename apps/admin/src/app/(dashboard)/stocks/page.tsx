import { type Metadata } from 'next';
import { Suspense } from 'react';

import { getAdminMessages } from '@sarwa/core/server';

import { StocksPage } from '../../../features/stocks/stocks-page';

export const metadata: Metadata = { title: getAdminMessages('en').nav.stocks };

export default function Page() {
  return (
    <Suspense>
      <StocksPage />
    </Suspense>
  );
}
