import { type Route } from 'next';
import NextLink from 'next/link';

import { type LinkComponent } from '@sarwa/ui';

// Lets shared @sarwa/ui components (breadcrumbs, heatmap) navigate with the Next router.
export const RouteLink: LinkComponent = ({ href, ...props }) => (
  <NextLink href={href as Route} {...props} />
);
