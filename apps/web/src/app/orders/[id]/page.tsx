import { type Metadata } from 'next';
import { Suspense } from 'react';

import { OrdersPage } from '../../../features/orders/orders-page';

export const metadata: Metadata = { title: 'Orders', robots: { index: false } };

// A shareable link to one order: the same list with its detail drawer open.
export default async function Page({ params }: PageProps<'/orders/[id]'>) {
  const { id } = await params;
  return (
    <Suspense>
      <OrdersPage routeOrderId={decodeURIComponent(id)} />
    </Suspense>
  );
}
