import { type Metadata } from 'next';

import { getMessages } from '@sarwa/core/server';

import { ConfigPage } from '../../../features/config/config-page';

export const metadata: Metadata = { title: getMessages('en').admin.nav.config };

export default function Page() {
  return <ConfigPage />;
}
