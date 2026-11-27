import { type AdminAccountsQuery, type AdminOrdersQuery, type AuditQuery } from '@sarwa/contracts';

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
  accountPages: ['admin', 'accounts'] as const,
  accounts: (query: AdminAccountsQuery) => ['admin', 'accounts', query] as const,
};
