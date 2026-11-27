import { Suspense } from 'react';

import { PersonalPage } from '../../features/gating/personal-page';
import { OrdersPage } from '../../features/orders/orders-page';
import { personalMetadata } from '../../lib/seo';

export const generateMetadata = () => personalMetadata('orders');

export default function Page() {
  return (
    <Suspense>
      <PersonalPage kind="orders">
        <OrdersPage />
      </PersonalPage>
    </Suspense>
  );
}
