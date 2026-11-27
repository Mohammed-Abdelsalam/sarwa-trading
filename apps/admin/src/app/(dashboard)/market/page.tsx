import { type Metadata } from 'next';

import { getAdminMessages } from '@sarwa/core/server';

import { MarketPage } from '../../../features/market/market-page';

export const metadata: Metadata = { title: getAdminMessages('en').nav.market };

export default function Page() {
  return <MarketPage />;
}
