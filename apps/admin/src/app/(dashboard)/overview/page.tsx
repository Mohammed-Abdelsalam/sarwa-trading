import { type Metadata } from 'next';

import { getAdminMessages } from '@sarwa/core/server';

import { OverviewPage } from '../../../features/overview/overview-page';

export const metadata: Metadata = { title: getAdminMessages('en').nav.overview };

export default function Page() {
  return <OverviewPage />;
}
