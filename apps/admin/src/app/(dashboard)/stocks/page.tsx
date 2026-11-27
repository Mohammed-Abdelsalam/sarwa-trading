import { type Metadata } from 'next';

import { getMessages } from '@sarwa/core/server';

import { StocksPage } from '../../../features/stocks/stocks-page';

export const metadata: Metadata = { title: getMessages('en').admin.nav.stocks };

export default function Page() {
  return <StocksPage />;
}
