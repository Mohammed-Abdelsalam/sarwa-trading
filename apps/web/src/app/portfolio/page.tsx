import { Suspense } from 'react';

import { PortfolioPage } from '../../features/portfolio/portfolio-page';
import { personalMetadata } from '../../lib/seo';

export const generateMetadata = () => personalMetadata('portfolio');

// The books belong to this browser's device id, so they are fetched on the client.
export default function Page() {
  return (
    <Suspense>
      <PortfolioPage />
    </Suspense>
  );
}
