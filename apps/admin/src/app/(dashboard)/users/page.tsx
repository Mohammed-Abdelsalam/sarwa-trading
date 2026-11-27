import { type Metadata } from 'next';

import { getMessages } from '@sarwa/core/server';

import { UsersPage } from '../../../features/users/users-page';

export const metadata: Metadata = { title: getMessages('en').admin.nav.users };

export default function Page() {
  return <UsersPage />;
}
