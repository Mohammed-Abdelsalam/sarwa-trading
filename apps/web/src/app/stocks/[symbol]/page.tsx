import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query';
import { type Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { Suspense } from 'react';

import { ErrorCode, type StockDetailResponse } from '@sarwa/contracts';
import { isApiError, queryKeys } from '@sarwa/core/server';

import { StockActions } from '../../../features/stock-detail/stock-actions';
import { StockDetailBody } from '../../../features/stock-detail/stock-detail-body';
import { StockHeading } from '../../../features/stock-detail/stock-heading';
import { OrderPanel } from '../../../features/trade/order-panel';
import { serverCopy, stockJsonLd } from '../../../lib/seo';
import { getStockDetail } from '../../../lib/server-api';

// A missing stock is a real 404 (the segment's not-found explains it); any other failure resolves to
// undefined so the client shows its own error state and retries.
async function loadStock(symbol: string): Promise<StockDetailResponse | undefined> {
  try {
    return await getStockDetail(symbol);
  } catch (error) {
    if (isApiError(error, ErrorCode.NotFound)) notFound();
    return undefined;
  }
}

export async function generateMetadata({
  params,
}: PageProps<'/stocks/[symbol]'>): Promise<Metadata> {
  const symbol = (await params).symbol.toUpperCase();
  const { t, m } = await serverCopy();
  const canonical = { alternates: { canonical: `/stocks/${symbol}` } };
  try {
    const { stock } = await getStockDetail(symbol);
    const title = m.seo.stockTitle({ symbol, name: stock.name });
    // No price: it would be stale in every search snippet and social card.
    const description = m.seo.stockDescription({
      symbol,
      name: stock.name,
      sector: t.sectors[stock.sector],
    });
    return {
      ...canonical,
      title,
      description,
      // Nested objects replace the layout's rather than merge, so the shared fields are repeated.
      openGraph: {
        type: 'website',
        siteName: m.seo.siteName,
        title,
        description,
        url: `/stocks/${symbol}`,
      },
      twitter: { card: 'summary_large_image', title, description },
    };
  } catch (error) {
    return isApiError(error, ErrorCode.NotFound)
      ? { title: m.seo.stockUnavailable({ symbol }), robots: { index: false } }
      : { ...canonical, title: symbol };
  }
}

export default async function Page({ params }: PageProps<'/stocks/[symbol]'>) {
  const requested = (await params).symbol;
  const symbol = requested.toUpperCase();
  if (requested !== symbol) permanentRedirect(`/stocks/${encodeURIComponent(symbol)}`);

  const [detail, { t }] = await Promise.all([loadStock(symbol), serverCopy()]);
  const queryClient = new QueryClient();
  if (detail) queryClient.setQueryData(queryKeys.stock(symbol), detail);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {detail ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: stockJsonLd({ stock: detail.stock, marketsLabel: t.markets.title }),
          }}
        />
      ) : null}
      <div className="grid w-full gap-6 px-4 pt-4 pb-24 md:px-8 md:pt-5 xl:grid-cols-[minmax(0,1fr)_23.75rem] xl:items-start xl:pb-8">
        <div className="flex min-w-0 flex-col gap-4.5">
          <StockHeading
            symbol={symbol}
            stock={detail?.stock}
            labels={{
              markets: t.markets.title,
              sector: detail ? t.sectors[detail.stock.sector] : undefined,
            }}
            actions={<StockActions symbol={symbol} />}
          />
          <Suspense>
            <StockDetailBody symbol={symbol} />
          </Suspense>
        </div>
        <Suspense>
          <OrderPanel symbol={symbol} />
        </Suspense>
      </div>
    </HydrationBoundary>
  );
}
