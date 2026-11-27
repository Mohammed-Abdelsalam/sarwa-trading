import { type MetadataRoute } from 'next';

import { PERSONAL_ROUTES, SITE_URL } from '../lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: ['/', '/markets', '/stocks/'], disallow: PERSONAL_ROUTES },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
