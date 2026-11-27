import { type Metadata } from 'next';

import { getMessages } from '@sarwa/core/server';

import { AccountsPage } from '../../../features/accounts/accounts-page';

export const metadata: Metadata = { title: getMessages('en').admin.nav.accounts };

export default function Page() {
  return <AccountsPage />;
}
