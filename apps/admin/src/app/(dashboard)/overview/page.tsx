import { type Metadata } from 'next';

import { getMessages } from '@sarwa/core/server';

import { OverviewPage } from '../../../features/overview/overview-page';

export const metadata: Metadata = { title: getMessages('en').admin.nav.overview };

export default function Page() {
  return <OverviewPage />;
}
