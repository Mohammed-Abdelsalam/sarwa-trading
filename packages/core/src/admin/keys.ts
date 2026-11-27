import { type AdminOrdersQuery, type AuditQuery, type CustomersQuery } from '@sarwa/contracts';

export const adminKeys = {
  all: ['admin'] as const,
  session: ['admin', 'session'] as const,
  stats: ['admin', 'stats'] as const,
  health: ['admin', 'health'] as const,
  config: ['admin', 'config'] as const,
  stocks: ['admin', 'stocks'] as const,
  users: ['admin', 'users'] as const,
  auditPages: ['admin', 'audit'] as const,
  audit: (query: AuditQuery) => ['admin', 'audit', query] as const,
  trading: ['admin', 'trading'] as const,
  haltImpact: (symbol: string) => ['admin', 'halt-impact', symbol] as const,
  orderLists: ['admin', 'orders', 'list'] as const,
  orders: (query: AdminOrdersQuery) => ['admin', 'orders', 'list', query] as const,
  orderStats: ['admin', 'orders', 'stats'] as const,
  // Every list page, the KPIs and each customer's tabs share this prefix.
  customersAll: ['admin', 'customers'] as const,
  customers: (query: CustomersQuery) => ['admin', 'customers', 'list', query] as const,
  customerKpis: ['admin', 'customers', 'kpis'] as const,
  customer: (handle: string) => ['admin', 'customers', 'detail', handle] as const,
  customerOrders: (handle: string) => ['admin', 'customers', 'detail', handle, 'orders'] as const,
  customerSessions: (handle: string) =>
    ['admin', 'customers', 'detail', handle, 'sessions'] as const,
  customerActivity: (handle: string) =>
    ['admin', 'customers', 'detail', handle, 'activity'] as const,
  invites: ['admin', 'invites'] as const,
  invite: (token: string) => ['admin', 'invites', 'token', token] as const,
};
