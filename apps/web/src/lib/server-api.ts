import { cache } from 'react';

import {
  MARKET_ROUTES,
  routePath,
  StockDetailResponseSchema,
  StocksResponseSchema,
  TRADING_ROUTES,
  TradingStatusSchema,
} from '@sarwa/contracts';
import { createRequest } from '@sarwa/core/server';

import { API_URL } from './api-url';

const request = createRequest({ baseUrl: process.env.API_URL ?? API_URL });

// Prices only paint the first frame: the socket replaces them on its first tick, so a snapshot a few
// seconds old is invisible and spares the API a call on every page view.
export const SNAPSHOT_REVALIDATE_SECONDS = 5;
const snapshot = { next: { revalidate: SNAPSHOT_REVALIDATE_SECONDS } };

// cache() dedupes the call between a page and its generateMetadata within one request.
export const getStockDetail = cache((symbol: string) =>
  request(routePath(MARKET_ROUTES.stock, { symbol }), StockDetailResponseSchema, snapshot),
);

export const getStocks = cache(
  async () =>
    (await request(routePath(MARKET_ROUTES.stocks), StocksResponseSchema, snapshot)).items,
);

// The kill switch and halts decide whether a ticket may submit, so they are never served stale.
export const getTradingStatus = () =>
  request(routePath(TRADING_ROUTES.tradingStatus), TradingStatusSchema, { cache: 'no-store' });
