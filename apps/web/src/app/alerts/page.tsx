import { Suspense } from 'react';

import { AlertsPage } from '../../features/alerts/alerts-page';
import { personalMetadata } from '../../lib/seo';

export const generateMetadata = () => personalMetadata('alerts');

export default function Page() {
  return (
    <Suspense>
      <AlertsPage />
    </Suspense>
  );
}
