import { Suspense } from 'react';

import { OrdersPage } from '../../features/orders/orders-page';
import { personalMetadata } from '../../lib/seo';

export const generateMetadata = () => personalMetadata('orders');

export default function Page() {
  return (
    <Suspense>
      <OrdersPage />
    </Suspense>
  );
}
