import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import { type Metadata } from 'next';
import { Suspense } from 'react';

import { formatPrice, isNotFound, queryKeys } from '@sarwa/core/server';

import { RemovedStockPage } from '../../../features/stock-detail/removed-stock-page';
import { StockDetailPage } from '../../../features/stock-detail/stock-detail-page';
import { getStockDetail } from '../../../lib/server-api';

export async function generateMetadata({
  params,
}: PageProps<'/stocks/[symbol]'>): Promise<Metadata> {
  const symbol = (await params).symbol.toUpperCase();
  try {
    const { stock, quote } = await getStockDetail(symbol);
    return {
      title: `${symbol} · ${stock.name}`,
      description: `${stock.name} (${symbol}) live price ${formatPrice(quote.price)}, chart and key statistics.`,
    };
  } catch (error) {
    return isNotFound(error)
      ? { title: `${symbol} unavailable`, robots: { index: false } }
      : { title: symbol };
  }
}

export default async function Page({ params }: PageProps<'/stocks/[symbol]'>) {
  const symbol = (await params).symbol.toUpperCase();
  const queryClient = new QueryClient();
  try {
    const detail = await getStockDetail(symbol);
    queryClient.setQueryData(queryKeys.stock(symbol), detail);
  } catch (error) {
    // A removed stock gets its own explained screen (X-A11y), not a bare 404; it is kept out of search.
    if (isNotFound(error)) return <RemovedStockPage symbol={symbol} />;
    // Any other failure: the client shows its own error state and retries.
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense>
        <StockDetailPage symbol={symbol} />
      </Suspense>
    </HydrationBoundary>
  );
}
