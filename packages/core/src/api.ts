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
  ErrorCode,
  type ErrorCodeValue,
  IDEMPOTENCY_KEY_HEADER,
  MARKET_ROUTES,
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

import { type AuthApi, createAuthApi } from './auth/api';

export class ApiError extends Error {
  // `body` keeps the fields a problem schema strips, such as a guest ticket or a retry time.
  constructor(
    readonly problem: Problem,
    readonly body: unknown = problem,
    // The server's X-Request-Id, for error states that quote it to support.
    readonly requestId: string | null = null,
  ) {
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

export function isApiError(error: unknown, code: ErrorCodeValue): error is ApiError {
  return error instanceof ApiError && error.problem.code === code;
}

// Reads a problem that carries more than the standard fields, e.g. RateLimitedProblemSchema.
export function problemDetails<T extends z.ZodType>(error: unknown, schema: T): z.output<T> | null {
  if (!(error instanceof ApiError)) return null;
  const parsed = schema.safeParse(error.body);
  return parsed.success ? parsed.data : null;
}

// A body that isn't a problem (e.g. a proxy's HTML error page) still gets the code its status means.
const CODE_BY_STATUS: Partial<Record<number, ErrorCodeValue>> = {
  401: ErrorCode.Unauthorized,
  403: ErrorCode.Forbidden,
  404: ErrorCode.NotFound,
  409: ErrorCode.Conflict,
  429: ErrorCode.RateLimited,
  503: ErrorCode.Unavailable,
};

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
  // Sign-in, refresh and the emailed links: a 401 there is the answer, not an expired session.
  anonymous?: boolean;
}

export type CallOptions = Pick<RequestOptions, 'signal'>;

export interface Request {
  <T extends z.ZodType>(path: string, schema: T, options?: RequestOptions): Promise<z.output<T>>;
  (path: string, schema: null, options?: RequestOptions): Promise<void>;
  (path: string, schema: 'text', options?: RequestOptions): Promise<string>;
}

export const REQUEST_ID_HEADER = 'x-request-id';

// Who the caller is: the device id, plus a signed-in session when there is one.
export interface RequestAuth {
  headers?: (request: {
    method: string;
  }) => Promise<Record<string, string>> | Record<string, string>;
  credentials?: RequestCredentials;
  // Asked after a 401; true means the session was renewed and the request is sent once more.
  refresh?: () => Promise<boolean>;
  onUnauthorized?: () => void;
}

export function createRequest({
  baseUrl,
  auth = {},
  timeoutMs = REQUEST_TIMEOUT_MS,
}: {
  baseUrl: string;
  auth?: RequestAuth;
  timeoutMs?: number;
}): Request {
  const root = `${baseUrl.replace(/\/$/, '')}/${API_PREFIX}`;

  const request = async (
    path: string,
    schema: z.ZodType | 'text' | null,
    { body, headers, signal, anonymous = false, ...init }: RequestOptions = {},
  ): Promise<unknown> => {
    const call = abortable(timeoutMs, signal);
    const send = async () =>
      fetch(`${root}${path}`, {
        ...init,
        signal: call.signal,
        credentials: auth.credentials,
        headers: {
          Accept: 'application/json',
          ...(body !== undefined && { 'Content-Type': 'application/json' }),
          ...(await auth.headers?.({ method: init.method ?? 'GET' })),
          ...headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    try {
      let response = await send();
      const session = !anonymous;
      if (response.status === 401 && session && (await auth.refresh?.())) response = await send();

      if (!response.ok) {
        const raw: unknown = await response.json().catch(() => null);
        const parsed = ProblemSchema.safeParse(raw);
        if (response.status === 401 && session) auth.onUnauthorized?.();
        throw new ApiError(
          parsed.success
            ? parsed.data
            : {
                type: 'about:blank',
                title: response.statusText,
                status: response.status,
                code: CODE_BY_STATUS[response.status] ?? ErrorCode.Internal,
              },
          raw,
          (response.headers as Headers | undefined)?.get(REQUEST_ID_HEADER) ?? null,
        );
      }
      if (schema === 'text') return await response.text();
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

export interface MarketApi {
  listStocks(options?: CallOptions): Promise<StocksResponse>;
  getStock(symbol: string, options?: CallOptions): Promise<StockDetailResponse>;
  getCandles(symbol: string, period: Period, options?: CallOptions): Promise<CandlesResponse>;
  getAppConfig(options?: CallOptions): Promise<AppConfig>;
}

export interface WatchlistApi {
  getWatchlist(options?: CallOptions): Promise<WatchlistResponse>;
  addToWatchlist(symbol: string): Promise<void>;
  removeFromWatchlist(symbol: string): Promise<void>;
}

export interface TradingApi {
  getAccount(options?: CallOptions): Promise<Account>;
  getPortfolio(options?: CallOptions): Promise<PortfolioResponse>;
  getEquity(period: EquityPeriod, options?: CallOptions): Promise<EquityResponse>;
  getTradingStatus(options?: CallOptions): Promise<TradingStatus>;
  placeOrder(request: PlaceOrderRequest, idempotencyKey: string): Promise<Order>;
  listOrders(query?: Partial<OrdersQuery>, options?: CallOptions): Promise<OrdersResponse>;
  getOrder(id: string, options?: CallOptions): Promise<Order>;
  cancelOrder(id: string): Promise<CancelOrderResponse>;
  modifyOrder(id: string, patch: ModifyOrderRequest): Promise<Order>;
}

export interface AlertsApi {
  listAlerts(options?: CallOptions): Promise<AlertsResponse>;
  createAlert(request: CreateAlertRequest): Promise<Alert>;
  updateAlert(id: string, patch: UpdateAlertRequest): Promise<Alert>;
  deleteAlert(id: string): Promise<void>;
}

export interface NotificationsApi {
  listNotifications(
    query?: Partial<NotificationsQuery>,
    options?: CallOptions,
  ): Promise<NotificationsResponse>;
  markNotificationRead(id: string): Promise<void>;
  markAllNotificationsRead(): Promise<void>;
  registerPushToken(request: PushTokenRequest): Promise<void>;
}

export interface ApiClient
  extends MarketApi, WatchlistApi, TradingApi, AlertsApi, NotificationsApi, AuthApi {
  request: Request;
}

const M = MARKET_ROUTES;
const R = TRADING_ROUTES;

// Empty values are left out, so an unset filter never reaches the server as "?q=".
export function queryString(query: object): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}

export function createMarketApi(request: Request): MarketApi {
  return {
    listStocks: (options) => request(routePath(M.stocks), StocksResponseSchema, options),
    getStock: (symbol, options) =>
      request(routePath(M.stock, { symbol }), StockDetailResponseSchema, options),
    getCandles: (symbol, period, options) =>
      request(
        `${routePath(M.candles, { symbol })}${queryString({ period })}`,
        CandlesResponseSchema,
        options,
      ),
    getAppConfig: (options) => request(routePath(M.appConfig), AppConfigSchema, options),
  };
}

export function createWatchlistApi(request: Request): WatchlistApi {
  return {
    getWatchlist: (options) => request(routePath(M.watchlist), WatchlistResponseSchema, options),
    addToWatchlist: (symbol) =>
      request(routePath(M.watchlistItem, { symbol }), null, { method: 'PUT' }),
    removeFromWatchlist: (symbol) =>
      request(routePath(M.watchlistItem, { symbol }), null, { method: 'DELETE' }),
  };
}

export function createTradingApi(request: Request): TradingApi {
  return {
    getAccount: (options) => request(routePath(R.account), AccountSchema, options),
    getPortfolio: (options) => request(routePath(R.portfolio), PortfolioResponseSchema, options),
    getEquity: (period, options) =>
      request(`${routePath(R.equity)}${queryString({ period })}`, EquityResponseSchema, options),
    getTradingStatus: (options) =>
      request(routePath(R.tradingStatus), TradingStatusSchema, options),
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
  };
}

export function createAlertsApi(request: Request): AlertsApi {
  return {
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
  };
}

export function createNotificationsApi(request: Request): NotificationsApi {
  return {
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
  };
}

// The device id always identifies the caller; `auth` adds a session on top when there is one.
export function createApiClient({
  baseUrl,
  getDeviceId,
  auth = {},
}: {
  baseUrl: string;
  getDeviceId: () => Promise<string>;
  auth?: RequestAuth;
}): ApiClient {
  const request = createRequest({
    baseUrl,
    auth: {
      ...auth,
      headers: async (request) => ({
        [DEVICE_ID_HEADER]: await getDeviceId(),
        ...(await auth.headers?.(request)),
      }),
    },
  });
  return {
    request,
    ...createMarketApi(request),
    ...createWatchlistApi(request),
    ...createTradingApi(request),
    ...createAlertsApi(request),
    ...createNotificationsApi(request),
    ...createAuthApi(request),
  };
}
