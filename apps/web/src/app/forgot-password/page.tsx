import { type Metadata } from 'next';
import { Suspense } from 'react';

import { ForgotPasswordScreen } from '../../features/auth/forgot-password-page';
import { serverCopy } from '../../lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await serverCopy();
  return { title: t.auth.forgot.title, robots: { index: false, follow: false } };
}

export default function Page() {
  return (
    <Suspense>
      <ForgotPasswordScreen />
    </Suspense>
  );
}
