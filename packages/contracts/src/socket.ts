import { z } from 'zod';

import { type AppConfig } from './config';
import { MAX_SUBSCRIBE_SYMBOLS } from './constants';
import { QuoteSchema, SymbolSchema, type MarketStatus, type Quote } from './market';

/**
 * Socket.IO contract for namespace `/market`.
 * The two interfaces are passed as generics to `Server` (NestJS) and `io()` (clients),
 * so event names and payloads are type-checked on both ends.
 */

export const SubscribePayloadSchema = z.object({
  symbols: z
    .array(SymbolSchema)
    .min(1)
    .max(MAX_SUBSCRIBE_SYMBOLS, `At most ${MAX_SUBSCRIBE_SYMBOLS} symbols per subscription`),
});

/** Ack for `subscribe`: the current snapshot, so the UI never waits for the next tick. */
export const SubscribeAckSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), quotes: z.array(QuoteSchema) }),
  z.object({
    ok: z.literal(false),
    error: z.object({ code: z.string(), message: z.string() }),
  }),
]);

export const QuotesEventSchema = z.array(QuoteSchema);

export const SocketErrorSchema = z.object({ code: z.string(), message: z.string() });

export const SocketEvent = {
  Subscribe: 'subscribe',
  Unsubscribe: 'unsubscribe',
  Quotes: 'quotes',
  MarketStatus: 'market:status',
  ConfigUpdated: 'config:updated',
  Error: 'error',
} as const;

export type SubscribePayload = z.infer<typeof SubscribePayloadSchema>;
export type SubscribeAck = z.infer<typeof SubscribeAckSchema>;
export type SocketError = z.infer<typeof SocketErrorSchema>;

export interface ClientToServerEvents {
  subscribe: (payload: SubscribePayload, ack: (res: SubscribeAck) => void) => void;
  unsubscribe: (payload: SubscribePayload) => void;
}

export interface ServerToClientEvents {
  /** batched: latest quote per changed symbol, only for symbols this socket subscribed to */
  quotes: (quotes: Quote[]) => void;
  'market:status': (status: MarketStatus) => void;
  'config:updated': (config: AppConfig) => void;
  error: (err: SocketError) => void;
}
