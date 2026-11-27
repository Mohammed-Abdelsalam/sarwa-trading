import { cache } from 'react';

import {
  StockDetailResponseSchema,
  StocksResponseSchema,
  TradingStatusSchema,
} from '@sarwa/contracts';
import { createRequest } from '@sarwa/core/server';

import { API_URL } from './api-url';

const request = createRequest({ baseUrl: process.env.API_URL ?? API_URL });

// cache() dedupes the call between a page and its generateMetadata within one request.
export const getStockDetail = cache((symbol: string) =>
  request(`/stocks/${encodeURIComponent(symbol)}`, StockDetailResponseSchema),
);

export const getStocks = cache(async () => (await request('/stocks', StocksResponseSchema)).items);

export const getTradingStatus = () => request('/trading/status', TradingStatusSchema);
