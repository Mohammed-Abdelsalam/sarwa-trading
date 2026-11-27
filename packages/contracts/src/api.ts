import { z } from 'zod';

import { ALERT_ISSUE_CODES, REJECTION_CODES } from '@sarwa/domain';

import {
  CandleSchema,
  PeriodSchema,
  QuoteSchema,
  StockSchema,
  StockStatsSchema,
  StockWithQuoteSchema,
  SymbolSchema,
} from './market';

export const StocksResponseSchema = z.object({ items: z.array(StockWithQuoteSchema) });

export const StockDetailResponseSchema = z.object({
  stock: StockSchema,
  quote: QuoteSchema,
  stats: StockStatsSchema,
});

export const StocksQuerySchema = z.object({ q: z.string().trim().max(64).optional() });
export const CandlesQuerySchema = z.object({ period: PeriodSchema });
export const CandlesResponseSchema = z.object({
  symbol: SymbolSchema,
  period: PeriodSchema,
  candles: z.array(CandleSchema),
});

export const WatchlistResponseSchema = z.object({ symbols: z.array(SymbolSchema) });

export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  uptimeSeconds: z.number().nonnegative(),
  // package.json version and the short git sha of the running build ("dev" when unknown).
  version: z.string().min(1),
  commit: z.string().min(1),
});

export const ErrorCode = {
  ValidationFailed: 'VALIDATION_FAILED',
  NotFound: 'NOT_FOUND',
  Conflict: 'CONFLICT',
  Unauthorized: 'UNAUTHORIZED',
  Forbidden: 'FORBIDDEN',
  RateLimited: 'RATE_LIMITED',
  Maintenance: 'MAINTENANCE',
  Unavailable: 'UNAVAILABLE',
  Internal: 'INTERNAL',
  IdempotencyMismatch: 'IDEMPOTENCY_MISMATCH',
  ConfirmationMismatch: 'CONFIRMATION_MISMATCH',
  AlertLimit: 'ALERT_LIMIT',
  InvalidPayload: 'INVALID_PAYLOAD',
  TooManySymbols: 'TOO_MANY_SYMBOLS',
  InvalidCredentials: 'INVALID_CREDENTIALS',
  InvalidCurrentPassword: 'INVALID_CURRENT_PASSWORD',
  EmailInUse: 'EMAIL_IN_USE',
  WeakPassword: 'WEAK_PASSWORD',
  TokenExpired: 'TOKEN_EXPIRED',
  AccountSuspended: 'ACCOUNT_SUSPENDED',
  SessionRevoked: 'SESSION_REVOKED',
  GuestDataPresent: 'GUEST_DATA_PRESENT',
  CsrfFailed: 'CSRF_FAILED',
} as const;

// A 422 carries the rule that refused it. A code this client doesn't know yet still parses, so the
// status and detail survive.
export const ErrorCodeSchema = z
  .enum([...Object.values(ErrorCode), ...REJECTION_CODES, ...ALERT_ISSUE_CODES])
  .catch(ErrorCode.Internal);

export const ProblemSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  code: ErrorCodeSchema,
  detail: z.string().optional(),
  errors: z.record(z.string(), z.array(z.string())).optional(),
});

export type StocksResponse = z.infer<typeof StocksResponseSchema>;
export type StockDetailResponse = z.infer<typeof StockDetailResponseSchema>;
export type StocksQuery = z.infer<typeof StocksQuerySchema>;
export type CandlesQuery = z.infer<typeof CandlesQuerySchema>;
export type CandlesResponse = z.infer<typeof CandlesResponseSchema>;
export type WatchlistResponse = z.infer<typeof WatchlistResponseSchema>;
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
export type Problem = z.infer<typeof ProblemSchema>;
export type ErrorCodeValue = z.infer<typeof ErrorCodeSchema>;
