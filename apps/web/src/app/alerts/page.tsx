import { Suspense } from 'react';

import { AlertsPage } from '../../features/alerts/alerts-page';
import { PersonalPage } from '../../features/gating/personal-page';
import { personalMetadata } from '../../lib/seo';

export const generateMetadata = () => personalMetadata('alerts');

export default function Page() {
  return (
    <Suspense>
      <PersonalPage kind="alerts">
        <AlertsPage />
      </PersonalPage>
    </Suspense>
  );
}
