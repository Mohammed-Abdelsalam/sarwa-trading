'use client';

import { useParams } from 'next/navigation';

import { RemovedStockPage } from '../../../features/stock-detail/removed-stock-page';

// not-found gets no props, so the symbol comes from the URL it was thrown for.
export default function NotFound() {
  const { symbol } = useParams<{ symbol: string }>();
  return <RemovedStockPage symbol={symbol.toUpperCase()} />;
}
