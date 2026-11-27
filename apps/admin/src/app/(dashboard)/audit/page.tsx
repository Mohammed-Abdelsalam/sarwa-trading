import { type Metadata } from 'next';

import { getMessages } from '@sarwa/core/server';

import { AuditPage } from '../../../features/audit/audit-page';

export const metadata: Metadata = { title: getMessages('en').admin.nav.audit };

export default function Page() {
  return <AuditPage />;
}
