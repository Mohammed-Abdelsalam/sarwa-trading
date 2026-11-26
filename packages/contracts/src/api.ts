import { z } from 'zod';

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
});

export const ProblemSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  code: z.string(),
  detail: z.string().optional(),
  errors: z.record(z.string(), z.array(z.string())).optional(),
});

export const ErrorCode = {
  ValidationFailed: 'VALIDATION_FAILED',
  NotFound: 'NOT_FOUND',
  Conflict: 'CONFLICT',
  Unauthorized: 'UNAUTHORIZED',
  Forbidden: 'FORBIDDEN',
  RateLimited: 'RATE_LIMITED',
  Maintenance: 'MAINTENANCE',
  Internal: 'INTERNAL',
} as const;

export type StocksResponse = z.infer<typeof StocksResponseSchema>;
export type StockDetailResponse = z.infer<typeof StockDetailResponseSchema>;
export type CandlesQuery = z.infer<typeof CandlesQuerySchema>;
export type CandlesResponse = z.infer<typeof CandlesResponseSchema>;
export type WatchlistResponse = z.infer<typeof WatchlistResponseSchema>;
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
export type Problem = z.infer<typeof ProblemSchema>;
export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];
