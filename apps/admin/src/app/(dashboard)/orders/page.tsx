import { type Metadata } from 'next';
import { Suspense } from 'react';

import { getAdminMessages } from '@sarwa/core/server';

import { OrdersPage } from '../../../features/orders/orders-page';

export const metadata: Metadata = { title: getAdminMessages('en').nav.orders };

export default function Page() {
  return (
    <Suspense>
      <OrdersPage />
    </Suspense>
  );
}
