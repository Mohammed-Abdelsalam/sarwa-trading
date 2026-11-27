import { type Metadata } from 'next';
import { Suspense } from 'react';

import { getAdminMessages } from '@sarwa/core/server';

import { AccountsPage } from '../../../features/accounts/accounts-page';

export const metadata: Metadata = { title: getAdminMessages('en').nav.accounts };

export default function Page() {
  return (
    <Suspense>
      <AccountsPage />
    </Suspense>
  );
}
