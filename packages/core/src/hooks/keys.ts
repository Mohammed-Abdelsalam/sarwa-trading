import { type EquityPeriod, type OrderFilter, type Period } from '@sarwa/contracts';

export interface OrderListQuery {
  filter?: OrderFilter;
  symbol?: string;
}

export const queryKeys = {
  stocks: ['stocks'] as const,
  stock: (symbol: string) => ['stocks', symbol] as const,
  candles: (symbol: string, period: Period) => ['stocks', symbol, 'candles', period] as const,
  appConfig: ['app-config'] as const,
  preference: (key: string) => ['preference', key] as const,
  tradingStatus: ['trading-status'] as const,
  session: ['session'] as const,
  // Device-scoped personal keys from before accounts; core reads personal data through meKeys.
  watchlist: ['watchlist'] as const,
  account: ['account'] as const,
  portfolio: ['portfolio'] as const,
  equity: (period: EquityPeriod) => ['portfolio', 'equity', period] as const,
  allOrders: ['orders'] as const,
  orderLists: ['orders', 'list'] as const,
  orders: (query: OrderListQuery = {}) => ['orders', 'list', query] as const,
  orderPageLists: ['orders', 'pages'] as const,
  orderPages: (query: OrderListQuery = {}) => ['orders', 'pages', query] as const,
  order: (id: string) => ['orders', 'detail', id] as const,
  alerts: ['alerts'] as const,
  notifications: ['notifications'] as const,
};

// Everything personal lives under one prefix, so an identity change drops it in one call while
// public data and preferences stay.
export const ME_SCOPE = ['me'] as const;

export function meKeys(userId: string) {
  const root = [...ME_SCOPE, userId] as const;
  return {
    root,
    watchlist: [...root, 'watchlist'] as const,
    account: [...root, 'account'] as const,
    summary: [...root, 'summary'] as const,
    sessions: [...root, 'sessions'] as const,
    // The prefix also matches every equity curve, which moves with the books.
    portfolio: [...root, 'portfolio'] as const,
    equity: (period: EquityPeriod) => [...root, 'portfolio', 'equity', period] as const,
    allOrders: [...root, 'orders'] as const,
    orderLists: [...root, 'orders', 'list'] as const,
    orders: (query: OrderListQuery = {}) => [...root, 'orders', 'list', query] as const,
    // Paged lists for the Orders screens; the first-page lists above serve the previews.
    orderPageLists: [...root, 'orders', 'pages'] as const,
    orderPages: (query: OrderListQuery = {}) => [...root, 'orders', 'pages', query] as const,
    order: (id: string) => [...root, 'orders', 'detail', id] as const,
    alerts: [...root, 'alerts'] as const,
    notifications: [...root, 'notifications'] as const,
  };
}

export type MeKeys = ReturnType<typeof meKeys>;
