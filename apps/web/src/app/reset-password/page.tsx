import { type Metadata } from 'next';
import { Suspense } from 'react';

import { ResetPasswordScreen } from '../../features/auth/reset-password-page';
import { serverCopy } from '../../lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await serverCopy();
  return { title: t.auth.reset.title, robots: { index: false, follow: false } };
}

export default function Page() {
  return (
    <Suspense>
      <ResetPasswordScreen />
    </Suspense>
  );
}
