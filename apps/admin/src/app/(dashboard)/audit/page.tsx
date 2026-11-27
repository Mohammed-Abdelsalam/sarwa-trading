import { type Metadata } from 'next';
import { Suspense } from 'react';

import { getAdminMessages } from '@sarwa/core/server';

import { AuditPage } from '../../../features/audit/audit-page';

export const metadata: Metadata = { title: getAdminMessages('en').nav.audit };

export default function Page() {
  return (
    <Suspense>
      <AuditPage />
    </Suspense>
  );
}
