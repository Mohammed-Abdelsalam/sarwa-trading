import { type Metadata } from 'next';

import { getMessages } from '@sarwa/core/server';

import { OrdersPage } from '../../../features/orders/orders-page';

export const metadata: Metadata = { title: getMessages('en').admin.nav.orders };

export default function Page() {
  return <OrdersPage />;
}
