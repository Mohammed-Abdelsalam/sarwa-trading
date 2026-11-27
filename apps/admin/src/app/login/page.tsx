import { type Metadata } from 'next';
import { Suspense } from 'react';

import { getMessages } from '@sarwa/core/server';

import { LoginPage } from '../../features/login/login-page';

export const metadata: Metadata = { title: getMessages('en').admin.login.title };

export default function Page() {
  return (
    <Suspense>
      <LoginPage />
    </Suspense>
  );
}
