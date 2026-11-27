// Every REST path, relative to API_PREFIX. Servers mount them as-is; clients fill the params in
// with routePath, so both sides break together when one changes.
export const MARKET_ROUTES = {
  stocks: 'stocks',
  stock: 'stocks/:symbol',
  candles: 'stocks/:symbol/candles',
  watchlist: 'watchlist',
  watchlistItem: 'watchlist/:symbol',
  appConfig: 'app-config',
  health: 'health',
} as const;

export const TRADING_ROUTES = {
  account: 'account',
  portfolio: 'portfolio',
  equity: 'portfolio/equity',
  tradingStatus: 'trading/status',
  orders: 'orders',
  order: 'orders/:id',
  cancelOrder: 'orders/:id/cancel',
  alerts: 'alerts',
  alert: 'alerts/:id',
  notifications: 'notifications',
  notificationRead: 'notifications/:id/read',
  notificationsReadAll: 'notifications/read-all',
  pushTokens: 'push-tokens',
} as const;

export const ADMIN_ROUTES = {
  login: 'admin/auth/login',
  logout: 'admin/auth/logout',
  me: 'admin/auth/me',
  stats: 'admin/stats',
  market: 'admin/market',
  config: 'admin/config',
  audit: 'admin/audit',
  stocks: 'admin/stocks',
  stock: 'admin/stocks/:symbol',
  users: 'admin/users',
  user: 'admin/users/:id',
  trading: 'admin/trading',
  halts: 'admin/halts',
  haltImpact: 'admin/halts/impact',
  resumeHalt: 'admin/halts/:symbol/resume',
  orders: 'admin/orders',
  orderStats: 'admin/orders/stats',
  // Customers are addressed by their public account handle (ACC-XXXXXX). Mount the static paths
  // (kpis, export.csv) before :handle.
  customers: 'admin/customers',
  customerKpis: 'admin/customers/kpis',
  customersExport: 'admin/customers/export.csv',
  customer: 'admin/customers/:handle',
  customerOrders: 'admin/customers/:handle/orders',
  customerSessions: 'admin/customers/:handle/sessions',
  customerActivity: 'admin/customers/:handle/activity',
  suspendCustomer: 'admin/customers/:handle/suspend',
  reactivateCustomer: 'admin/customers/:handle/reactivate',
  signOutCustomer: 'admin/customers/:handle/sign-out-all',
  sendCustomerReset: 'admin/customers/:handle/password-reset',
  resetCustomerAccount: 'admin/customers/:handle/reset-account',
  revealCustomer: 'admin/customers/:handle/reveal',
  invites: 'admin/invites',
  invite: 'admin/invites/:id',
  resendInvite: 'admin/invites/:id/resend',
  // Public: the accept page reads the invite, then accepts it with a name and password.
  inviteByToken: 'admin/invites/token/:token',
  acceptInvite: 'admin/invites/accept',
} as const;

// Customer auth and the signed-in customer's own account. The refresh cookie is scoped to auth/.
export const AUTH_ROUTES = {
  signUp: 'auth/sign-up',
  signIn: 'auth/sign-in',
  signOut: 'auth/sign-out',
  refresh: 'auth/refresh',
  forgot: 'auth/forgot',
  resetInfo: 'auth/reset/:token',
  reset: 'auth/reset',
  verify: 'auth/verify',
  resendVerify: 'auth/verify/resend',
  sessions: 'auth/sessions',
  revokeSession: 'auth/sessions/:id',
  signOutOthers: 'auth/sessions/revoke-others',
  me: 'me',
  profile: 'me/profile',
  password: 'me/password',
  summary: 'me/summary',
  deleteAccount: 'me/delete',
  selfReset: 'me/account/reset',
} as const;

type RouteParams<R extends string> = R extends `${string}:${infer P}/${infer Rest}`
  ? P | RouteParams<Rest>
  : R extends `${string}:${infer P}`
    ? P
    : never;

export function routePath<R extends string>(
  route: R,
  ...[params]: [RouteParams<R>] extends [never] ? [] : [Record<RouteParams<R>, string>]
): string {
  const values = (params ?? {}) as Record<string, string>;
  return `/${route.replace(/:(\w+)/g, (_, key: string) => encodeURIComponent(values[key] ?? ''))}`;
}
