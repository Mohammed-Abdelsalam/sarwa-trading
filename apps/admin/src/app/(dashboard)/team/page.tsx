import { type Metadata } from 'next';
import { Suspense } from 'react';

import { getAdminMessages } from '@sarwa/core/server';

import { TeamScreen } from '../../../features/team/team-page';

export const metadata: Metadata = { title: getAdminMessages('en').nav.team };

export default function Page() {
  return (
    <Suspense>
      <TeamScreen />
    </Suspense>
  );
}
