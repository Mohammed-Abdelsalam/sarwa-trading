import { z } from 'zod';

import { MARKET_VOLATILITY, STOCK_VOLATILITY } from './constants';
import {
  ExchangeSchema,
  MarketStatusSchema,
  SectorSchema,
  StockSchema,
  SymbolSchema,
} from './market';

/** Admin dashboard API (prefix /api/v1/admin). Session = httpOnly JWT cookie. */

// ── auth & users ─────────────────────────────────────────────────────────────

/** ADMIN: full control. VIEWER: read-only — sees everything, changes nothing. */
export const RoleSchema = z.enum(['ADMIN', 'VIEWER']);
export const UserStatusSchema = z.enum(['active', 'disabled']);

export const AdminUserSchema = z.object({
  id: z.string().min(1),
  email: z.email(),
  name: z.string().min(1).max(80),
  role: RoleSchema,
  status: UserStatusSchema,
  /** ISO-8601; null if never signed in */
  lastActiveAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});

export const LoginRequestSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

export const SessionResponseSchema = z.object({ user: AdminUserSchema });

export const CreateUserSchema = z.object({
  email: z.email('Enter a full email address, e.g. sam@minitrading.dev'),
  name: z.string().trim().min(1).max(80),
  role: RoleSchema,
  /** initial password set by the inviting admin */
  password: LoginRequestSchema.shape.password,
});

export const UpdateUserSchema = z
  .object({ role: RoleSchema, status: UserStatusSchema })
  .partial()
  .refine((v) => v.role !== undefined || v.status !== undefined, 'Nothing to update');

export const UsersResponseSchema = z.object({ items: z.array(AdminUserSchema) });

// ── market control ───────────────────────────────────────────────────────────

export const MarketCommandSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('pause') }),
  z.object({ action: z.literal('resume') }),
  z.object({
    action: z.literal('setVolatility'),
    volatility: z.number().min(MARKET_VOLATILITY.min).max(MARKET_VOLATILITY.max),
  }),
  /** UI asks the admin to type DROP; the API requires the same explicit confirmation */
  z.object({ action: z.literal('dropConnections'), confirm: z.literal('DROP') }),
]);

export const MarketCommandResponseSchema = z.object({
  status: MarketStatusSchema,
  /** set for dropConnections */
  dropped: z.number().int().nonnegative().optional(),
});

// ── stocks management ────────────────────────────────────────────────────────

export const AdminStockSchema = StockSchema.extend({
  basePrice: z.number().positive(),
  volatility: z.number().min(STOCK_VOLATILITY.min).max(STOCK_VOLATILITY.max),
  marketCap: z.number().nonnegative(),
  peRatio: z.number().positive().nullable(),
  isEnabled: z.boolean(),
  /** live price from the simulator (null when disabled and never ticked) */
  price: z.number().positive().nullable(),
  updatedAt: z.iso.datetime(),
});

/** Editable stock fields WITHOUT defaults (shared by create and update). */
const StockFieldsSchema = z.object({
  name: z.string().trim().min(1, 'Company name is required').max(80),
  sector: SectorSchema,
  exchange: ExchangeSchema,
  basePrice: z.number().positive('Must be > 0'),
  volatility: z
    .number()
    .min(STOCK_VOLATILITY.min, `${STOCK_VOLATILITY.min} – ${STOCK_VOLATILITY.max}`)
    .max(STOCK_VOLATILITY.max, `${STOCK_VOLATILITY.min} – ${STOCK_VOLATILITY.max}`),
  marketCap: z.number().nonnegative(),
  peRatio: z.number().positive().nullable(),
  isEnabled: z.boolean(),
});

export const CreateStockSchema = StockFieldsSchema.extend({
  symbol: SymbolSchema,
  marketCap: StockFieldsSchema.shape.marketCap.default(0),
  peRatio: StockFieldsSchema.shape.peRatio.default(null),
  isEnabled: StockFieldsSchema.shape.isEnabled.default(true),
});

/**
 * Partial update. Built from the default-free fields on purpose: in Zod 4 `.partial()` keeps
 * `.default()`s, which would silently overwrite untouched fields (e.g. re-enable a stock
 * when only its name was edited). A test guards this.
 */
export const UpdateStockSchema = StockFieldsSchema.partial().refine(
  (v) => Object.keys(v).length > 0,
  'Nothing to update',
);

export const AdminStocksResponseSchema = z.object({ items: z.array(AdminStockSchema) });

// ── audit log ────────────────────────────────────────────────────────────────

export const AUDIT_ACTIONS = [
  'auth.login',
  'market.pause',
  'market.resume',
  'market.volatility',
  'connections.drop',
  'stock.create',
  'stock.update',
  'stock.delete',
  'config.update',
  'user.create',
  'user.role',
  'user.status',
] as const;

export const AuditActionSchema = z.enum(AUDIT_ACTIONS);

export const AuditLogSchema = z.object({
  id: z.string().min(1),
  actorEmail: z.string(),
  action: AuditActionSchema,
  /** human label, e.g. "Stock · INTC", "Market", "Config · banner" */
  entity: z.string(),
  payload: z.record(z.string(), z.unknown()),
  ip: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

/** Query string: repeated `action` params are allowed (?action=a&action=b). */
/** GET /admin/audit?page=1&pageSize=25&action=market.pause&actor=maya@… */
export const AuditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  action: AuditActionSchema.optional(),
  actor: z.string().optional(),
});

export const AuditPageSchema = z.object({
  items: z.array(AuditLogSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().nonnegative(),
});

// ── overview stats ───────────────────────────────────────────────────────────

export const AdminStatsSchema = z.object({
  connectedClients: z.number().int().nonnegative(),
  activeSubscriptions: z.number().int().nonnegative(),
  devices: z.number().int().nonnegative(),
  watchlistItems: z.number().int().nonnegative(),
  topWatchlisted: z.array(
    z.object({ symbol: SymbolSchema, count: z.number().int().nonnegative() }),
  ),
  market: MarketStatusSchema.extend({
    ticksPerSecond: z.number().nonnegative(),
    enabledSymbols: z.number().int().nonnegative(),
    totalSymbols: z.number().int().nonnegative(),
  }),
  recentActivity: z.array(AuditLogSchema),
});

export type Role = z.infer<typeof RoleSchema>;
export type UserStatus = z.infer<typeof UserStatusSchema>;
export type AdminUser = z.infer<typeof AdminUserSchema>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type SessionResponse = z.infer<typeof SessionResponseSchema>;
export type CreateUser = z.infer<typeof CreateUserSchema>;
export type UpdateUser = z.infer<typeof UpdateUserSchema>;
export type UsersResponse = z.infer<typeof UsersResponseSchema>;
export type MarketCommand = z.infer<typeof MarketCommandSchema>;
export type MarketCommandResponse = z.infer<typeof MarketCommandResponseSchema>;
export type AdminStock = z.infer<typeof AdminStockSchema>;
export type CreateStock = z.input<typeof CreateStockSchema>;
export type UpdateStock = z.infer<typeof UpdateStockSchema>;
export type AdminStocksResponse = z.infer<typeof AdminStocksResponseSchema>;
export type AuditAction = z.infer<typeof AuditActionSchema>;
export type AuditLog = z.infer<typeof AuditLogSchema>;
export type AuditQuery = z.input<typeof AuditQuerySchema>;
export type AuditPage = z.infer<typeof AuditPageSchema>;
export type AdminStats = z.infer<typeof AdminStatsSchema>;
