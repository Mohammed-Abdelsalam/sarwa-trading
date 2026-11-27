import { z } from 'zod';

import { SymbolSchema } from './market';
import {
  AlertSchema,
  HaltSchema,
  NotificationSchema,
  OrderSchema,
  TradingStatusSchema,
} from './trading';

// Trading events are versioned so a client can drop a shape it doesn't understand instead of
// misreading it. Private events go to the device's own room, never to a symbol room.
const versioned = <T extends z.ZodRawShape>(shape: T) => z.object({ v: z.literal(1), ...shape });

export const OrderUpdatedEventSchema = versioned({ order: OrderSchema });
export const AlertTriggeredEventSchema = versioned({
  alert: AlertSchema,
  lastTicks: z.number().int().positive(),
});
export const NotificationEventSchema = versioned({ notification: NotificationSchema });
export const SymbolHaltedEventSchema = versioned({ halt: HaltSchema });
export const SymbolResumedEventSchema = versioned({
  symbol: SymbolSchema,
  at: z.number().int().nonnegative(),
});
export const TradingStatusEventSchema = versioned({ status: TradingStatusSchema });
// An admin reset the account: open clients drop their cached books and refetch.
export const AccountResetEventSchema = versioned({});

// The socket handshake proves which device's private room to join.
export const SocketAuthSchema = z.object({ deviceId: z.uuid() });

export const TradingSocketEvent = {
  OrderUpdated: 'order.updated',
  AlertTriggered: 'alert.triggered',
  Notification: 'notification',
  SymbolHalted: 'symbol.halted',
  SymbolResumed: 'symbol.resumed',
  TradingStatus: 'trading.status',
  AccountReset: 'account.reset',
} as const;

export type OrderUpdatedEvent = z.infer<typeof OrderUpdatedEventSchema>;
export type AlertTriggeredEvent = z.infer<typeof AlertTriggeredEventSchema>;
export type NotificationEvent = z.infer<typeof NotificationEventSchema>;
export type SymbolHaltedEvent = z.infer<typeof SymbolHaltedEventSchema>;
export type SymbolResumedEvent = z.infer<typeof SymbolResumedEventSchema>;
export type TradingStatusEvent = z.infer<typeof TradingStatusEventSchema>;
export type AccountResetEvent = z.infer<typeof AccountResetEventSchema>;
export type SocketAuth = z.infer<typeof SocketAuthSchema>;

export interface TradingServerToClientEvents {
  'order.updated': (event: OrderUpdatedEvent) => void;
  'alert.triggered': (event: AlertTriggeredEvent) => void;
  notification: (event: NotificationEvent) => void;
  'symbol.halted': (event: SymbolHaltedEvent) => void;
  'symbol.resumed': (event: SymbolResumedEvent) => void;
  'trading.status': (event: TradingStatusEvent) => void;
  'account.reset': (event: AccountResetEvent) => void;
}
