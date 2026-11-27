import { Suspense } from 'react';

import { PersonalPage } from '../../../features/gating/personal-page';
import { OrdersPage } from '../../../features/orders/orders-page';
import { personalMetadata } from '../../../lib/seo';

export const generateMetadata = () => personalMetadata('orders');

// A shareable link to one order: the same list with its detail drawer open.
export default async function Page({ params }: PageProps<'/orders/[id]'>) {
  const { id } = await params;
  return (
    <Suspense>
      <PersonalPage kind="orders">
        <OrdersPage routeOrderId={decodeURIComponent(id)} />
      </PersonalPage>
    </Suspense>
  );
}
