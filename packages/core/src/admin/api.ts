import {
  type Account,
  AccountSchema,
  ADMIN_ROUTES,
  type AdminAccountsQuery,
  type AdminAccountsResponse,
  AdminAccountsResponseSchema,
  type AdminOrdersQuery,
  type AdminOrdersResponse,
  AdminOrdersResponseSchema,
  type AdminOrderStats,
  AdminOrderStatsSchema,
  type AdminStats,
  AdminStatsSchema,
  type AdminStock,
  AdminStockSchema,
  type AdminStocksResponse,
  AdminStocksResponseSchema,
  type AdminTrading,
  AdminTradingSchema,
  type AdminUser,
  AdminUserSchema,
  type AppConfig,
  AppConfigSchema,
  type AuditPage,
  AuditPageSchema,
  type AuditQuery,
  type CreateHalt,
  type CreateStock,
  type CreateUser,
  type Halt,
  type HealthResponse,
  HealthResponseSchema,
  type HaltImpact,
  HaltImpactSchema,
  HaltSchema,
  type LoginRequest,
  MARKET_ROUTES,
  type MarketCommand,
  type MarketCommandResponse,
  MarketCommandResponseSchema,
  routePath,
  SessionResponseSchema,
  type UpdateAppConfig,
  type UpdateStock,
  type UpdateTrading,
  type UpdateUser,
  type UsersResponse,
  UsersResponseSchema,
} from '@sarwa/contracts';

import { type CallOptions, createRequest, queryString } from '../api';

export interface AdminApi {
  login(body: LoginRequest): Promise<AdminUser>;
  logout(): Promise<void>;
  me(options?: CallOptions): Promise<AdminUser>;
  stats(options?: CallOptions): Promise<AdminStats>;
  health(options?: CallOptions): Promise<HealthResponse>;
  marketCommand(command: MarketCommand): Promise<MarketCommandResponse>;
  getConfig(options?: CallOptions): Promise<AppConfig>;
  updateConfig(patch: UpdateAppConfig): Promise<AppConfig>;
  listStocks(options?: CallOptions): Promise<AdminStocksResponse>;
  createStock(body: CreateStock): Promise<AdminStock>;
  updateStock(symbol: string, patch: UpdateStock): Promise<AdminStock>;
  deleteStock(symbol: string): Promise<void>;
  listUsers(options?: CallOptions): Promise<UsersResponse>;
  createUser(body: CreateUser): Promise<AdminUser>;
  updateUser(id: string, patch: UpdateUser): Promise<AdminUser>;
  audit(query: AuditQuery, options?: CallOptions): Promise<AuditPage>;
  trading(options?: CallOptions): Promise<AdminTrading>;
  updateTrading(patch: UpdateTrading): Promise<AdminTrading>;
  haltImpact(symbol: string, options?: CallOptions): Promise<HaltImpact>;
  createHalt(body: CreateHalt): Promise<Halt>;
  resumeHalt(symbol: string): Promise<void>;
  orders(query: AdminOrdersQuery, options?: CallOptions): Promise<AdminOrdersResponse>;
  orderStats(options?: CallOptions): Promise<AdminOrderStats>;
  accounts(query: AdminAccountsQuery, options?: CallOptions): Promise<AdminAccountsResponse>;
  resetAccount(id: string, confirm: string): Promise<Account>;
}

// Same-origin by default: the session cookie is httpOnly and SameSite=strict.
export function createAdminApi({
  baseUrl = '',
  onUnauthorized,
  timeoutMs,
}: {
  baseUrl?: string;
  onUnauthorized?: () => void;
  timeoutMs?: number;
} = {}): AdminApi {
  const raw = createRequest({ baseUrl, auth: { credentials: 'include' }, timeoutMs });
  const request = createRequest({
    baseUrl,
    auth: { credentials: 'include', onUnauthorized },
    timeoutMs,
  });
  const R = ADMIN_ROUTES;

  return {
    // Login answers 401 for wrong credentials, so it never triggers the sign-in redirect.
    login: async (body) =>
      (await raw(routePath(R.login), SessionResponseSchema, { method: 'POST', body })).user,
    logout: () => raw(routePath(R.logout), null, { method: 'POST' }),
    me: async (options) => (await request(routePath(R.me), SessionResponseSchema, options)).user,
    stats: (options) => request(routePath(R.stats), AdminStatsSchema, options),
    health: (options) => raw(routePath(MARKET_ROUTES.health), HealthResponseSchema, options),
    marketCommand: (body) =>
      request(routePath(R.market), MarketCommandResponseSchema, { method: 'POST', body }),
    getConfig: (options) => request(routePath(MARKET_ROUTES.appConfig), AppConfigSchema, options),
    updateConfig: (body) =>
      request(routePath(R.config), AppConfigSchema, { method: 'PATCH', body }),
    listStocks: (options) => request(routePath(R.stocks), AdminStocksResponseSchema, options),
    createStock: (body) => request(routePath(R.stocks), AdminStockSchema, { method: 'POST', body }),
    updateStock: (symbol, body) =>
      request(routePath(R.stock, { symbol }), AdminStockSchema, { method: 'PATCH', body }),
    deleteStock: (symbol) => request(routePath(R.stock, { symbol }), null, { method: 'DELETE' }),
    listUsers: (options) => request(routePath(R.users), UsersResponseSchema, options),
    createUser: (body) => request(routePath(R.users), AdminUserSchema, { method: 'POST', body }),
    updateUser: (id, body) =>
      request(routePath(R.user, { id }), AdminUserSchema, { method: 'PATCH', body }),
    audit: (query, options) =>
      request(`${routePath(R.audit)}${queryString(query)}`, AuditPageSchema, options),
    trading: (options) => request(routePath(R.trading), AdminTradingSchema, options),
    updateTrading: (body) =>
      request(routePath(R.trading), AdminTradingSchema, { method: 'PATCH', body }),
    haltImpact: (symbol, options) =>
      request(`${routePath(R.haltImpact)}${queryString({ symbol })}`, HaltImpactSchema, options),
    createHalt: (body) => request(routePath(R.halts), HaltSchema, { method: 'POST', body }),
    resumeHalt: (symbol) => request(routePath(R.resumeHalt, { symbol }), null, { method: 'POST' }),
    orders: (query, options) =>
      request(`${routePath(R.orders)}${queryString(query)}`, AdminOrdersResponseSchema, options),
    orderStats: (options) => request(routePath(R.orderStats), AdminOrderStatsSchema, options),
    accounts: (query, options) =>
      request(
        `${routePath(R.accounts)}${queryString(query)}`,
        AdminAccountsResponseSchema,
        options,
      ),
    resetAccount: (id, confirm) =>
      request(routePath(R.resetAccount, { id }), AccountSchema, {
        method: 'POST',
        body: { confirm },
      }),
  };
}
