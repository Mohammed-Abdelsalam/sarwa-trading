import { appMessages } from '../../../lib/messages';
import { OG_SIZE, ogCard } from '../../../lib/og-card';
import { getStockDetail } from '../../../lib/server-api';

export const alt = appMessages.en.seo.siteName;
export const size = OG_SIZE;
export const contentType = 'image/png';

// Name and exchange only: a price on a cached social card would be wrong within seconds.
export default async function Image({ params }: { params: Promise<{ symbol: string }> }) {
  const symbol = (await params).symbol.toUpperCase();
  const stock = await getStockDetail(symbol).then(
    (detail) => detail.stock,
    () => null,
  );
  return ogCard({
    title: stock ? stock.name : symbol,
    subtitle: stock ? `${stock.exchange}: ${symbol}` : appMessages.en.seo.siteName,
  });
}
