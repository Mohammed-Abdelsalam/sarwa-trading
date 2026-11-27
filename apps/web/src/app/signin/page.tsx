import { type Metadata } from 'next';
import { Suspense } from 'react';

import { SignInScreen } from '../../features/auth/sign-in-page';
import { serverCopy } from '../../lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await serverCopy();
  return { title: t.auth.signIn.title, robots: { index: false, follow: false } };
}

export default function Page() {
  return (
    <Suspense>
      <SignInScreen />
    </Suspense>
  );
}
