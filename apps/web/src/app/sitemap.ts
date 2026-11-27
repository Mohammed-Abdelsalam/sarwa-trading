import { type MetadataRoute } from 'next';

import { SITE_URL } from '../lib/seo';
import { getStocks } from '../lib/server-api';

// Normally refreshed with the stock list's snapshot cache; the hour is the ceiling if the API was
// down when it was built.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // If the API is down the public pages are still listed; the stocks come back on the next rebuild.
  const stocks = await getStocks().catch(() => []);
  return [
    { url: SITE_URL, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/markets`, changeFrequency: 'daily', priority: 0.9 },
    ...stocks.map((stock) => ({
      url: `${SITE_URL}/stocks/${stock.symbol}`,
      changeFrequency: 'daily' as const,
      priority: 0.7,
    })),
  ];
}
