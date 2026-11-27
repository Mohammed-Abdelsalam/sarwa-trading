import { type Metadata } from 'next';
import { Suspense } from 'react';

import { VerifyEmailScreen } from '../../features/auth/verify-email-page';
import { serverCopy } from '../../lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await serverCopy();
  return { title: t.auth.verify.checking, robots: { index: false, follow: false } };
}

export default function Page() {
  return (
    <Suspense>
      <VerifyEmailScreen />
    </Suspense>
  );
}
