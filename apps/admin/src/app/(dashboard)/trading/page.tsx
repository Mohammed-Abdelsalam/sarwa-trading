import { type Metadata } from 'next';

import { getAdminMessages } from '@sarwa/core/server';

import { TradingPage } from '../../../features/trading/trading-page';

export const metadata: Metadata = { title: getAdminMessages('en').nav.trading };

export default function Page() {
  return <TradingPage />;
}
