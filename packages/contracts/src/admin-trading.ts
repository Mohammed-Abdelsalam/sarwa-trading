import { z } from 'zod';

import { SymbolSchema } from './market';
import {
  CircuitBreakerSchema,
  ExecutionRulesSchema,
  OrderSchema,
  OrderTypeSchema,
  RejectionCodeSchema,
  SessionModeSchema,
  TradingStatusSchema,
} from './trading';

const Count = z.number().int().nonnegative();
const Cents = z.number().int();
const Timestamp = z.number().int().nonnegative();

export const AdminTradingSchema = TradingStatusSchema.extend({
  circuitBreaker: CircuitBreakerSchema,
  tripsToday: z.array(z.object({ symbol: SymbolSchema, at: Timestamp })),
  changedBy: z.string().nullable(),
  changedAt: Timestamp.nullable(),
});

export const UpdateTradingSchema = z
  .object({
    tradingEnabled: z.boolean().optional(),
    sessionMode: SessionModeSchema.optional(),
    rules: ExecutionRulesSchema.partial().optional(),
    circuitBreaker: CircuitBreakerSchema.partial().optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, 'Change at least one setting')
  .refine(
    (patch) =>
      patch.rules?.minNotionalCents === undefined ||
      patch.rules.maxNotionalCents === undefined ||
      patch.rules.minNotionalCents < patch.rules.maxNotionalCents,
    { error: 'Min notional must be below max notional', path: ['rules', 'minNotionalCents'] },
  );

export const HALT_DURATIONS = ['5m', '15m', 'until_close', 'manual'] as const;

export const CreateHaltSchema = z.object({
  symbol: SymbolSchema,
  message: z.string().trim().min(1, 'Tell users why trading is paused').max(80),
  duration: z.enum(HALT_DURATIONS),
  notify: z.boolean(),
});

// What the halt dialog warns about before it's confirmed.
export const HaltImpactSchema = z.object({
  symbol: SymbolSchema,
  openOrders: Count,
  holdersAndWatchers: Count,
});

export const AdminOrderSchema = OrderSchema.extend({
  accountHandle: z.string(),
  // Time from the request reaching the server to the order being accepted or rejected.
  latencyMs: Count,
});

export const AdminOrdersQuerySchema = z.object({
  status: OrderSchema.shape.status.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const AdminOrdersResponseSchema = z.object({ items: z.array(AdminOrderSchema) });

export const AdminOrderStatsSchema = z.object({
  ordersToday: Count,
  fillRateBps: Count,
  rejectedBps: Count,
  notionalTodayCents: Cents,
  activeTraders: Count,
  rejectionsByReason: z.array(z.object({ code: RejectionCodeSchema, count: Count })),
  typeMix: z.array(z.object({ type: OrderTypeSchema, count: Count })),
  amountOrders: Count,
});

// Reset is irreversible, so it's confirmed by typing the account's handle (accounts have no email).
export const resetConfirmation = (handle: string) => `RESET ${handle}`;

export type AdminTrading = z.infer<typeof AdminTradingSchema>;
export type UpdateTrading = z.infer<typeof UpdateTradingSchema>;
export type HaltDuration = (typeof HALT_DURATIONS)[number];
export type CreateHalt = z.infer<typeof CreateHaltSchema>;
export type HaltImpact = z.infer<typeof HaltImpactSchema>;
export type AdminOrder = z.infer<typeof AdminOrderSchema>;
export type AdminOrdersQuery = z.input<typeof AdminOrdersQuerySchema>;
export type AdminOrdersResponse = z.infer<typeof AdminOrdersResponseSchema>;
export type AdminOrderStats = z.infer<typeof AdminOrderStatsSchema>;

// The admin socket namespace is authenticated with the admin session cookie.
export const ADMIN_NAMESPACE = '/admin';

export const AdminSocketEvent = {
  Order: 'admin.order',
  TradingStatus: 'admin.trading',
} as const;

export const AdminOrderEventSchema = z.object({ v: z.literal(1), order: AdminOrderSchema });

export const AdminTradingEventSchema = z.object({ v: z.literal(1), trading: AdminTradingSchema });

export type AdminOrderEvent = z.infer<typeof AdminOrderEventSchema>;
export type AdminTradingEvent = z.infer<typeof AdminTradingEventSchema>;

export interface AdminServerToClientEvents {
  'admin.order': (event: AdminOrderEvent) => void;
  'admin.trading': (event: AdminTradingEvent) => void;
}
