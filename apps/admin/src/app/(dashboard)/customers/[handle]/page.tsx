import { type Metadata } from 'next';
import { Suspense } from 'react';

import { getAdminMessages } from '@sarwa/core/server';

import { CustomerDetailScreen } from '../../../../features/customer-detail/customer-detail-page';

export const metadata: Metadata = { title: getAdminMessages('en').nav.customers };

export default async function Page({ params }: PageProps<'/customers/[handle]'>) {
  const { handle } = await params;
  return (
    <Suspense>
      <CustomerDetailScreen handle={decodeURIComponent(handle)} />
    </Suspense>
  );
}
