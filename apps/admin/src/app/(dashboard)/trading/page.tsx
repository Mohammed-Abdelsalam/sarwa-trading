import { type Metadata } from 'next';

import { getMessages } from '@sarwa/core/server';

import { TradingPage } from '../../../features/trading/trading-page';

export const metadata: Metadata = { title: getMessages('en').admin.nav.trading };

export default function Page() {
  return <TradingPage />;
}
