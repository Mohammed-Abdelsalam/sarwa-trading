import { type Metadata } from 'next';
import { Suspense } from 'react';

import { getAdminMessages } from '@sarwa/core/server';

import { UsersPage } from '../../../features/users/users-page';

export const metadata: Metadata = { title: getAdminMessages('en').nav.users };

export default function Page() {
  return (
    <Suspense>
      <UsersPage />
    </Suspense>
  );
}
