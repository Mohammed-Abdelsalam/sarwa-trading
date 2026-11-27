import { type Metadata } from 'next';

import { getAdminMessages } from '@sarwa/core/server';

import { ConfigPage } from '../../../features/config/config-page';

export const metadata: Metadata = { title: getAdminMessages('en').nav.config };

export default function Page() {
  return <ConfigPage />;
}
