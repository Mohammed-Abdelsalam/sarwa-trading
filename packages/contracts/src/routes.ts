// Every REST path, relative to API_PREFIX. Servers mount them as-is; clients fill the params in
// with routePath, so both sides break together when one changes.
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
  accounts: 'admin/accounts',
  resetAccount: 'admin/accounts/:id/reset',
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
