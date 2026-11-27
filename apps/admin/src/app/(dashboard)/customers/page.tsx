import { type Metadata } from 'next';
import { Suspense } from 'react';

import { getAdminMessages } from '@sarwa/core/server';

import { CustomersScreen } from '../../../features/customers/customers-page';

export const metadata: Metadata = { title: getAdminMessages('en').nav.customers };

export default function Page() {
  return (
    <Suspense>
      <CustomersScreen />
    </Suspense>
  );
}
