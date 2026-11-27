import { type z } from 'zod';

import {
  type Account,
  AccountSchema,
  type Alert,
  AlertResponseSchema,
  type AlertsResponse,
  AlertsResponseSchema,
  API_PREFIX,
  type AppConfig,
  AppConfigSchema,
  type CancelOrderResponse,
  CancelOrderResponseSchema,
  type CandlesResponse,
  CandlesResponseSchema,
  type CreateAlertRequest,
  DEVICE_ID_HEADER,
  type EquityPeriod,
  type EquityResponse,
  EquityResponseSchema,
  IDEMPOTENCY_KEY_HEADER,
  type ModifyOrderRequest,
  type NotificationsQuery,
  type NotificationsResponse,
  NotificationsResponseSchema,
  type Order,
  type OrdersQuery,
  type OrdersResponse,
  OrdersResponseSchema,
  type Period,
  type PlaceOrderRequest,
  PlaceOrderResponseSchema,
  type PortfolioResponse,
  PortfolioResponseSchema,
  type Problem,
  ProblemSchema,
  type StockDetailResponse,
  StockDetailResponseSchema,
  type StocksResponse,
  StocksResponseSchema,
  type PushTokenRequest,
  routePath,
  type TradingStatus,
  TRADING_ROUTES,
  TradingStatusSchema,
  type UpdateAlertRequest,
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
  getAccount(options?: CallOptions): Promise<Account>;
  getPortfolio(options?: CallOptions): Promise<PortfolioResponse>;
  getEquity(period: EquityPeriod, options?: CallOptions): Promise<EquityResponse>;
  placeOrder(request: PlaceOrderRequest, idempotencyKey: string): Promise<Order>;
  listOrders(query?: Partial<OrdersQuery>, options?: CallOptions): Promise<OrdersResponse>;
  getOrder(id: string, options?: CallOptions): Promise<Order>;
  cancelOrder(id: string): Promise<CancelOrderResponse>;
  modifyOrder(id: string, patch: ModifyOrderRequest): Promise<Order>;
  listAlerts(options?: CallOptions): Promise<AlertsResponse>;
  createAlert(request: CreateAlertRequest): Promise<Alert>;
  updateAlert(id: string, patch: UpdateAlertRequest): Promise<Alert>;
  deleteAlert(id: string): Promise<void>;
  listNotifications(
    query?: Partial<NotificationsQuery>,
    options?: CallOptions,
  ): Promise<NotificationsResponse>;
  markNotificationRead(id: string): Promise<void>;
  markAllNotificationsRead(): Promise<void>;
  registerPushToken(request: PushTokenRequest): Promise<void>;
  getTradingStatus(options?: CallOptions): Promise<TradingStatus>;
}

const R = TRADING_ROUTES;

function queryString(query: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : '';
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
    getAccount: (options) => request(routePath(R.account), AccountSchema, options),
    getPortfolio: (options) => request(routePath(R.portfolio), PortfolioResponseSchema, options),
    getEquity: (period, options) =>
      request(`${routePath(R.equity)}?period=${period}`, EquityResponseSchema, options),
    placeOrder: async (body, idempotencyKey) =>
      (
        await request(routePath(R.orders), PlaceOrderResponseSchema, {
          method: 'POST',
          body,
          headers: { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey },
        })
      ).order,
    listOrders: (query = {}, options) =>
      request(`${routePath(R.orders)}${queryString(query)}`, OrdersResponseSchema, options),
    getOrder: async (id, options) =>
      (await request(routePath(R.order, { id }), PlaceOrderResponseSchema, options)).order,
    cancelOrder: (id) =>
      request(routePath(R.cancelOrder, { id }), CancelOrderResponseSchema, { method: 'POST' }),
    modifyOrder: async (id, body) =>
      (
        await request(routePath(R.order, { id }), PlaceOrderResponseSchema, {
          method: 'PATCH',
          body,
        })
      ).order,
    listAlerts: (options) => request(routePath(R.alerts), AlertsResponseSchema, options),
    createAlert: async (body) =>
      (await request(routePath(R.alerts), AlertResponseSchema, { method: 'POST', body })).alert,
    updateAlert: async (id, body) =>
      (
        await request(routePath(R.alert, { id }), AlertResponseSchema, {
          method: 'PATCH',
          body,
        })
      ).alert,
    deleteAlert: (id) => request(routePath(R.alert, { id }), null, { method: 'DELETE' }),
    listNotifications: (query = {}, options) =>
      request(
        `${routePath(R.notifications)}${queryString(query)}`,
        NotificationsResponseSchema,
        options,
      ),
    markNotificationRead: (id) =>
      request(routePath(R.notificationRead, { id }), null, { method: 'POST' }),
    markAllNotificationsRead: () =>
      request(routePath(R.notificationsReadAll), null, { method: 'POST' }),
    registerPushToken: (body) => request(routePath(R.pushTokens), null, { method: 'POST', body }),
    getTradingStatus: (options) =>
      request(routePath(R.tradingStatus), TradingStatusSchema, options),
  };
}
