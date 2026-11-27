import { type Metadata } from 'next';

import { getMessages } from '@sarwa/core/server';

import { MarketPage } from '../../../features/market/market-page';

export const metadata: Metadata = { title: getMessages('en').admin.nav.market };

export default function Page() {
  return <MarketPage />;
}
