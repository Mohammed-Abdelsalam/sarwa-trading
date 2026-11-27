import { io, type Socket } from 'socket.io-client';
import { z } from 'zod';

import {
  ADMIN_NAMESPACE,
  type AdminOrder,
  AdminOrderEventSchema,
  type AdminServerToClientEvents,
  AdminSocketEvent,
  type AdminTrading,
  AdminTradingSchema,
} from '@sarwa/contracts';

export type AdminIo = Socket<AdminServerToClientEvents>;

const TradingEventSchema = z.object({ v: z.literal(1), trading: AdminTradingSchema });

export interface AdminSocket {
  connect(): void;
  disconnect(): void;
  onOrder(listener: (order: AdminOrder) => void): () => void;
  onTrading(listener: (trading: AdminTrading) => void): () => void;
}

const defaultCreateSocket = (url: string): AdminIo =>
  io(url, {
    transports: ['websocket'],
    autoConnect: false,
    withCredentials: true,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 30_000,
  });

function listenerSet<T>() {
  const listeners = new Set<(value: T) => void>();
  return {
    add: (listener: (value: T) => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    emit: (value: T) => {
      listeners.forEach((listener) => {
        listener(value);
      });
    },
  };
}

export function createAdminSocket({
  url,
  onUnauthorized,
  createSocket = defaultCreateSocket,
}: {
  url: string;
  onUnauthorized?: () => void;
  createSocket?: (url: string) => AdminIo;
}): AdminSocket {
  const socket = createSocket(`${url.replace(/\/$/, '')}${ADMIN_NAMESPACE}`);
  const orders = listenerSet<AdminOrder>();
  const trading = listenerSet<AdminTrading>();

  // Events are checked against their v1 schema; a shape this dashboard doesn't know is dropped.
  socket.on(AdminSocketEvent.Order, (payload: unknown) => {
    const parsed = AdminOrderEventSchema.safeParse(payload);
    if (parsed.success) orders.emit(parsed.data.order);
  });
  socket.on(AdminSocketEvent.TradingStatus, (payload: unknown) => {
    const parsed = TradingEventSchema.safeParse(payload);
    if (parsed.success) trading.emit(parsed.data.trading);
  });
  socket.on('connect_error', (error) => {
    if (error.message === 'Unauthorized') onUnauthorized?.();
  });

  return {
    connect() {
      if (!socket.connected && !socket.active) socket.connect();
    },
    disconnect() {
      socket.disconnect();
    },
    onOrder: orders.add,
    onTrading: trading.add,
  };
}
