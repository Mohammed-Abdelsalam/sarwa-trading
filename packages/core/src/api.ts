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

export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Request timed out after ${String(ms)} ms`);
    this.name = 'TimeoutError';
  }
}

export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

const MAX_RETRIES = 2;
const RETRYABLE_CLIENT_STATUSES = new Set([408, 429]);

export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (
    error instanceof ApiError &&
    error.status < 500 &&
    !RETRYABLE_CLIENT_STATUSES.has(error.status)
  ) {
    return false;
  }
  return failureCount < MAX_RETRIES;
}

export const REQUEST_TIMEOUT_MS = 10_000;

// Hand-rolled instead of AbortSignal.any/timeout, which React Native doesn't ship everywhere.
function abortable(ms: number, outer: AbortSignal | null | undefined) {
  const controller = new AbortController();
  const forward = () => {
    controller.abort(outer?.reason);
  };
  const timer = setTimeout(() => {
    controller.abort(new TimeoutError(ms));
  }, ms);
  if (outer?.aborted) forward();
  else outer?.addEventListener('abort', forward, { once: true });
  return {
    signal: controller.signal,
    release: () => {
      clearTimeout(timer);
      outer?.removeEventListener('abort', forward);
    },
  };
}

export interface RequestOptions extends Omit<RequestInit, 'body' | 'headers'> {
  body?: unknown;
  headers?: Record<string, string>;
}

export type CallOptions = Pick<RequestOptions, 'signal'>;

export interface Request {
  <T extends z.ZodType>(path: string, schema: T, options?: RequestOptions): Promise<z.output<T>>;
  (path: string, schema: null, options?: RequestOptions): Promise<void>;
}

export function createRequest({
  baseUrl,
  headers: getHeaders,
  credentials,
  timeoutMs = REQUEST_TIMEOUT_MS,
}: {
  baseUrl: string;
  headers?: () => Promise<Record<string, string>> | Record<string, string>;
  credentials?: RequestCredentials;
  timeoutMs?: number;
}): Request {
  const root = `${baseUrl.replace(/\/$/, '')}/${API_PREFIX}`;

  const request = async (
    path: string,
    schema: z.ZodType | null,
    { body, headers, signal, ...init }: RequestOptions = {},
  ): Promise<unknown> => {
    const call = abortable(timeoutMs, signal);
    try {
      const response = await fetch(`${root}${path}`, {
        ...init,
        signal: call.signal,
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
    } catch (error) {
      // Some fetch polyfills reject with a generic AbortError; surface the real reason instead.
      if (call.signal.aborted && call.signal.reason !== undefined) throw call.signal.reason;
      throw error;
    } finally {
      call.release();
    }
  };
  return request as Request;
}

export interface ApiClient {
  request: Request;
  listStocks(options?: CallOptions): Promise<StocksResponse>;
  getStock(symbol: string, options?: CallOptions): Promise<StockDetailResponse>;
  getCandles(symbol: string, period: Period, options?: CallOptions): Promise<CandlesResponse>;
  getAppConfig(options?: CallOptions): Promise<AppConfig>;
  getWatchlist(options?: CallOptions): Promise<WatchlistResponse>;
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
    listStocks: (options) => request('/stocks', StocksResponseSchema, options),
    getStock: (symbol, options) => request(`/stocks/${symbol}`, StockDetailResponseSchema, options),
    getCandles: (symbol, period, options) =>
      request(`/stocks/${symbol}/candles?period=${period}`, CandlesResponseSchema, options),
    getAppConfig: (options) => request('/app-config', AppConfigSchema, options),
    getWatchlist: (options) => request('/watchlist', WatchlistResponseSchema, options),
    addToWatchlist: (symbol) => request(`/watchlist/${symbol}`, null, { method: 'PUT' }),
    removeFromWatchlist: (symbol) => request(`/watchlist/${symbol}`, null, { method: 'DELETE' }),
  };
}
