import {
  type AcceptInviteRequest,
  ADMIN_ROUTES,
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
  type CreateInviteRequest,
  type CreateStock,
  type CustomerActionResponse,
  CustomerActionResponseSchema,
  type CustomerActivityResponse,
  CustomerActivityResponseSchema,
  type CustomerDetail,
  CustomerDetailSchema,
  type CustomerKpis,
  CustomerKpisSchema,
  type CustomerPageQuery,
  type CustomerReasonRequest,
  type CustomerRevealResponse,
  CustomerRevealResponseSchema,
  type CustomersQuery,
  type CustomersResponse,
  CustomersResponseSchema,
  type CustomerSessionsResponse,
  CustomerSessionsResponseSchema,
  type Halt,
  type HealthResponse,
  HealthResponseSchema,
  type HaltImpact,
  HaltImpactSchema,
  HaltSchema,
  type InviteInfo,
  InviteInfoSchema,
  type InviteRow,
  InviteResponseSchema,
  type InvitesResponse,
  InvitesResponseSchema,
  type LoginRequest,
  MARKET_ROUTES,
  type MarketCommand,
  type MarketCommandResponse,
  MarketCommandResponseSchema,
  type OrdersResponse,
  OrdersResponseSchema,
  type ResetCustomerAccountRequest,
  routePath,
  SessionResponseSchema,
  type SuspendCustomerRequest,
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
  updateUser(id: string, patch: UpdateUser): Promise<AdminUser>;
  audit(query: AuditQuery, options?: CallOptions): Promise<AuditPage>;
  trading(options?: CallOptions): Promise<AdminTrading>;
  updateTrading(patch: UpdateTrading): Promise<AdminTrading>;
  haltImpact(symbol: string, options?: CallOptions): Promise<HaltImpact>;
  createHalt(body: CreateHalt): Promise<Halt>;
  resumeHalt(symbol: string): Promise<void>;
  orders(query: AdminOrdersQuery, options?: CallOptions): Promise<AdminOrdersResponse>;
  orderStats(options?: CallOptions): Promise<AdminOrderStats>;
  customers(query: CustomersQuery, options?: CallOptions): Promise<CustomersResponse>;
  customerKpis(options?: CallOptions): Promise<CustomerKpis>;
  // The CSV text for the current filters; ADMIN only and audited.
  exportCustomers(query: CustomersQuery): Promise<string>;
  customer(handle: string, options?: CallOptions): Promise<CustomerDetail>;
  customerOrders(
    handle: string,
    query: CustomerPageQuery,
    options?: CallOptions,
  ): Promise<OrdersResponse>;
  customerSessions(handle: string, options?: CallOptions): Promise<CustomerSessionsResponse>;
  customerActivity(
    handle: string,
    query: CustomerPageQuery,
    options?: CallOptions,
  ): Promise<CustomerActivityResponse>;
  suspendCustomer(handle: string, body: SuspendCustomerRequest): Promise<CustomerActionResponse>;
  reactivateCustomer(handle: string, body: CustomerReasonRequest): Promise<CustomerActionResponse>;
  signOutCustomer(handle: string, body: CustomerReasonRequest): Promise<CustomerActionResponse>;
  sendCustomerReset(handle: string, body: CustomerReasonRequest): Promise<CustomerActionResponse>;
  resetCustomerAccount(
    handle: string,
    body: ResetCustomerAccountRequest,
  ): Promise<CustomerActionResponse>;
  revealCustomer(handle: string): Promise<CustomerRevealResponse>;
  invites(options?: CallOptions): Promise<InvitesResponse>;
  createInvite(body: CreateInviteRequest): Promise<InviteRow>;
  resendInvite(id: string): Promise<InviteRow>;
  revokeInvite(id: string): Promise<void>;
  inviteInfo(token: string, options?: CallOptions): Promise<InviteInfo>;
  acceptInvite(body: AcceptInviteRequest): Promise<AdminUser>;
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
  type CustomerActionRoute =
    | typeof R.suspendCustomer
    | typeof R.reactivateCustomer
    | typeof R.signOutCustomer
    | typeof R.sendCustomerReset
    | typeof R.resetCustomerAccount;
  const customerAction = (route: CustomerActionRoute, handle: string, body: unknown) =>
    request(routePath(route, { handle }), CustomerActionResponseSchema, { method: 'POST', body });

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
    customers: (query, options) =>
      request(`${routePath(R.customers)}${queryString(query)}`, CustomersResponseSchema, options),
    customerKpis: (options) => request(routePath(R.customerKpis), CustomerKpisSchema, options),
    exportCustomers: (query) =>
      request(`${routePath(R.customersExport)}${queryString(query)}`, 'text'),
    customer: (handle, options) =>
      request(routePath(R.customer, { handle }), CustomerDetailSchema, options),
    customerOrders: (handle, query, options) =>
      request(
        `${routePath(R.customerOrders, { handle })}${queryString(query)}`,
        OrdersResponseSchema,
        options,
      ),
    customerSessions: (handle, options) =>
      request(routePath(R.customerSessions, { handle }), CustomerSessionsResponseSchema, options),
    customerActivity: (handle, query, options) =>
      request(
        `${routePath(R.customerActivity, { handle })}${queryString(query)}`,
        CustomerActivityResponseSchema,
        options,
      ),
    suspendCustomer: (handle, body) => customerAction(R.suspendCustomer, handle, body),
    reactivateCustomer: (handle, body) => customerAction(R.reactivateCustomer, handle, body),
    signOutCustomer: (handle, body) => customerAction(R.signOutCustomer, handle, body),
    sendCustomerReset: (handle, body) => customerAction(R.sendCustomerReset, handle, body),
    resetCustomerAccount: (handle, body) => customerAction(R.resetCustomerAccount, handle, body),
    revealCustomer: (handle) =>
      request(routePath(R.revealCustomer, { handle }), CustomerRevealResponseSchema, {
        method: 'POST',
      }),
    invites: (options) => request(routePath(R.invites), InvitesResponseSchema, options),
    createInvite: async (body) =>
      (await request(routePath(R.invites), InviteResponseSchema, { method: 'POST', body })).invite,
    resendInvite: async (id) =>
      (await request(routePath(R.resendInvite, { id }), InviteResponseSchema, { method: 'POST' }))
        .invite,
    revokeInvite: (id) => request(routePath(R.invite, { id }), null, { method: 'DELETE' }),
    // The accept page is public: a 401 there never sends the invitee to the sign-in page.
    inviteInfo: (token, options) =>
      raw(routePath(R.inviteByToken, { token }), InviteInfoSchema, options),
    acceptInvite: async (body) =>
      (await raw(routePath(R.acceptInvite), SessionResponseSchema, { method: 'POST', body })).user,
  };
}
