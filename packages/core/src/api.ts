import { type z } from 'zod';

import {
  API_PREFIX,
  type AppConfig,
  AppConfigSchema,
  type CandlesResponse,
  CandlesResponseSchema,
  DEVICE_ID_HEADER,
  type Period,
  type Problem,
  ProblemSchema,
  type StockDetailResponse,
  StockDetailResponseSchema,
  type StocksResponse,
  StocksResponseSchema,
  type WatchlistResponse,
  WatchlistResponseSchema,
} from '@sarwa/contracts';

export class ApiError extends Error {
  constructor(readonly problem: Problem) {
    super(problem.detail ?? problem.title);
    this.name = 'ApiError';
  }

  get status(): number {
    return this.problem.status;
  }
}

export interface RequestOptions extends Omit<RequestInit, 'body' | 'headers'> {
  body?: unknown;
  headers?: Record<string, string>;
}

export interface Request {
  <T extends z.ZodType>(path: string, schema: T, options?: RequestOptions): Promise<z.output<T>>;
  (path: string, schema: null, options?: RequestOptions): Promise<void>;
}

export function createRequest({
  baseUrl,
  headers: getHeaders,
  credentials,
}: {
  baseUrl: string;
  headers?: () => Promise<Record<string, string>> | Record<string, string>;
  credentials?: RequestCredentials;
}): Request {
  const root = `${baseUrl.replace(/\/$/, '')}/${API_PREFIX}`;

  const request = async (
    path: string,
    schema: z.ZodType | null,
    { body, headers, ...init }: RequestOptions = {},
  ): Promise<unknown> => {
    const response = await fetch(`${root}${path}`, {
      ...init,
      credentials,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(await getHeaders?.()),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!response.ok) {
      const parsed = ProblemSchema.safeParse(await response.json().catch(() => null));
      throw new ApiError(
        parsed.success
          ? parsed.data
          : {
              type: 'about:blank',
              title: response.statusText,
              status: response.status,
              code: 'INTERNAL',
            },
      );
    }
    if (schema === null || response.status === 204) return undefined;
    return schema.parse(await response.json());
  };
  return request as Request;
}

export interface ApiClient {
  request: Request;
  listStocks(): Promise<StocksResponse>;
  getStock(symbol: string): Promise<StockDetailResponse>;
  getCandles(symbol: string, period: Period): Promise<CandlesResponse>;
  getAppConfig(): Promise<AppConfig>;
  getWatchlist(): Promise<WatchlistResponse>;
  addToWatchlist(symbol: string): Promise<void>;
  removeFromWatchlist(symbol: string): Promise<void>;
}

export function createApiClient({
  baseUrl,
  getDeviceId,
}: {
  baseUrl: string;
  getDeviceId: () => Promise<string>;
}): ApiClient {
  const request = createRequest({
    baseUrl,
    headers: async () => ({ [DEVICE_ID_HEADER]: await getDeviceId() }),
  });

  return {
    request,
    listStocks: () => request('/stocks', StocksResponseSchema),
    getStock: (symbol) => request(`/stocks/${symbol}`, StockDetailResponseSchema),
    getCandles: (symbol, period) =>
      request(`/stocks/${symbol}/candles?period=${period}`, CandlesResponseSchema),
    getAppConfig: () => request('/app-config', AppConfigSchema),
    getWatchlist: () => request('/watchlist', WatchlistResponseSchema),
    addToWatchlist: (symbol) => request(`/watchlist/${symbol}`, null, { method: 'PUT' }),
    removeFromWatchlist: (symbol) => request(`/watchlist/${symbol}`, null, { method: 'DELETE' }),
  };
}
