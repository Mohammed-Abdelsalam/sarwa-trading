import { Suspense } from 'react';

import { PersonalPage } from '../../features/gating/personal-page';
import { PortfolioPage } from '../../features/portfolio/portfolio-page';
import { personalMetadata } from '../../lib/seo';

export const generateMetadata = () => personalMetadata('portfolio');

// The books are personal, so they are fetched on the client once the session is known.
export default function Page() {
  return (
    <Suspense>
      <PersonalPage kind="portfolio">
        <PortfolioPage />
      </PersonalPage>
    </Suspense>
  );
}
