import { type EquityPeriod, type OrderFilter, type Period } from '@sarwa/contracts';

export interface OrderListQuery {
  filter?: OrderFilter;
  symbol?: string;
}

export const queryKeys = {
  stocks: ['stocks'] as const,
  stock: (symbol: string) => ['stocks', symbol] as const,
  candles: (symbol: string, period: Period) => ['stocks', symbol, 'candles', period] as const,
  watchlist: ['watchlist'] as const,
  appConfig: ['app-config'] as const,
  preference: (key: string) => ['preference', key] as const,
  account: ['account'] as const,
  // The prefix also matches every equity curve, which moves with the books.
  portfolio: ['portfolio'] as const,
  equity: (period: EquityPeriod) => ['portfolio', 'equity', period] as const,
  allOrders: ['orders'] as const,
  orderLists: ['orders', 'list'] as const,
  orders: (query: OrderListQuery = {}) => ['orders', 'list', query] as const,
  // Paged lists for the Orders screens; the first-page lists above serve the previews.
  orderPageLists: ['orders', 'pages'] as const,
  orderPages: (query: OrderListQuery = {}) => ['orders', 'pages', query] as const,
  order: (id: string) => ['orders', 'detail', id] as const,
  alerts: ['alerts'] as const,
  notifications: ['notifications'] as const,
  tradingStatus: ['trading-status'] as const,
};
