import { type Metadata } from 'next';
import { Suspense } from 'react';

import { SignUpScreen } from '../../features/auth/sign-up-page';
import { serverCopy } from '../../lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await serverCopy();
  return { title: t.auth.signUp.title, robots: { index: false, follow: false } };
}

export default function Page() {
  return (
    <Suspense>
      <SignUpScreen />
    </Suspense>
  );
}
