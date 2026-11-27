import { io, type Socket } from 'socket.io-client';
import { type z } from 'zod';

import {
  AlertTriggeredEventSchema,
  AppConfigSchema,
  type ClientToServerEvents,
  MARKET_NAMESPACE,
  MarketStatusSchema,
  NotificationEventSchema,
  OrderUpdatedEventSchema,
  type Quote,
  QuotesEventSchema,
  type ServerToClientEvents,
  type SocketAuth,
  StocksChangedEventSchema,
  SymbolHaltedEventSchema,
  SymbolResumedEventSchema,
  type TradingServerToClientEvents,
  TradingStatusEventSchema,
} from '@sarwa/contracts';

import { type ConnectionState, type LiveStore } from './store';

type MarketIo = Socket<ServerToClientEvents & TradingServerToClientEvents, ClientToServerEvents>;

export type SocketAuthProvider = (callback: (auth: Partial<SocketAuth>) => void) => void;

export type TradingEvent = {
  [Name in keyof TradingServerToClientEvents]: {
    name: Name;
    payload: Parameters<TradingServerToClientEvents[Name]>[0];
  };
}[keyof TradingServerToClientEvents];

export type TradingEventListener = (event: TradingEvent) => void;

export interface MarketSocketOptions {
  url: string;
  store: LiveStore;
  getDeviceId: () => Promise<string>;
  flushMs?: number;
  syncDelayMs?: number;
  reconnectJitterMs?: number;
  createSocket?: (url: string, auth: SocketAuthProvider) => MarketIo;
}

export interface MarketSocket {
  connect(): void;
  disconnect(): void;
  acquire(symbols: string[]): () => void;
  subscribedSymbols(): string[];
  onTradingEvent(listener: TradingEventListener): () => void;
}

const defaultCreateSocket = (url: string, auth: SocketAuthProvider): MarketIo =>
  io(url, {
    transports: ['websocket'],
    autoConnect: false,
    reconnectionDelay: 500,
    reconnectionDelayMax: 15_000,
    randomizationFactor: 0.5,
    auth,
  });

export function createMarketSocket({
  url,
  store,
  getDeviceId,
  flushMs = 100,
  syncDelayMs = 200,
  reconnectJitterMs = 1_000,
  createSocket = defaultCreateSocket,
}: MarketSocketOptions): MarketSocket {
  // Resolved on every (re)connect, so the handshake always carries the stored device id.
  const auth: SocketAuthProvider = (callback) => {
    getDeviceId().then(
      (deviceId) => {
        callback({ deviceId });
      },
      () => {
        callback({});
      },
    );
  };
  const socket = createSocket(`${url.replace(/\/$/, '')}${MARKET_NAMESPACE}`, auth);
  const tradingListeners = new Set<TradingEventListener>();
  const refCounts = new Map<string, number>();
  const subscribed = new Set<string>();
  const buffer = new Map<string, Quote>();
  let flushTimer: ReturnType<typeof setInterval> | undefined;
  let syncTimer: ReturnType<typeof setTimeout> | undefined;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  const setConnection = (connection: ConnectionState) => {
    store.getState().setConnection(connection);
  };

  // Socket events only fill a buffer; the store is updated at most every `flushMs`.
  const flush = () => {
    if (buffer.size === 0) return;
    store.getState().applyQuotes([...buffer.values()]);
    buffer.clear();
  };

  const subscribe = (symbols: string[]) => {
    if (symbols.length === 0) return;
    for (const symbol of symbols) subscribed.add(symbol);
    socket.emit('subscribe', { symbols }, (ack) => {
      if (ack.ok) store.getState().applyQuotes(ack.quotes);
    });
  };

  const sync = () => {
    syncTimer = undefined;
    if (!socket.connected) return;
    const wanted = [...refCounts.keys()];
    const removed = [...subscribed].filter((symbol) => !refCounts.has(symbol));
    if (removed.length > 0) {
      for (const symbol of removed) subscribed.delete(symbol);
      socket.emit('unsubscribe', { symbols: removed });
    }
    subscribe(wanted.filter((symbol) => !subscribed.has(symbol)));
  };

  const scheduleSync = () => {
    syncTimer ??= setTimeout(sync, syncDelayMs);
  };

  socket.on('connect', () => {
    setConnection({ status: 'open' });
    subscribed.clear();
    subscribe([...refCounts.keys()]);
  });
  socket.on('disconnect', (reason) => {
    subscribed.clear();
    if (reason === 'io client disconnect') {
      setConnection({ status: 'offline' });
      return;
    }
    setConnection({ status: 'reconnecting', attempt: 0 });
    // Socket.IO won't reconnect after a server-side kick; jitter so dropped clients don't return at once.
    if (reason === 'io server disconnect') {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = undefined;
        socket.connect();
      }, Math.random() * reconnectJitterMs);
    }
  });
  socket.io.on('reconnect_attempt', (attempt) => {
    setConnection({ status: 'reconnecting', attempt });
  });
  socket.on('quotes', (payload) => {
    const parsed = QuotesEventSchema.safeParse(payload);
    if (!parsed.success) return;
    for (const quote of parsed.data) buffer.set(quote.symbol, quote);
  });
  socket.on('market:status', (payload) => {
    const parsed = MarketStatusSchema.safeParse(payload);
    if (parsed.success) store.getState().setMarketStatus(parsed.data);
  });
  socket.on('config:updated', (payload) => {
    const parsed = AppConfigSchema.safeParse(payload);
    if (parsed.success) store.getState().setAppConfig(parsed.data);
  });
  socket.on('stocks:changed', (payload) => {
    const parsed = StocksChangedEventSchema.safeParse(payload);
    if (parsed.success) store.getState().setStocksChangedAt(parsed.data.at);
  });

  // Each event is checked against its v1 schema; a shape this client doesn't know is dropped.
  const relay =
    <T>(schema: z.ZodType<T>, toEvent: (payload: T) => TradingEvent) =>
    (payload: unknown) => {
      const parsed = schema.safeParse(payload);
      if (!parsed.success) return;
      const event = toEvent(parsed.data);
      tradingListeners.forEach((listener) => {
        listener(event);
      });
    };
  socket.on(
    'order.updated',
    relay(OrderUpdatedEventSchema, (payload) => ({ name: 'order.updated', payload })),
  );
  socket.on(
    'alert.triggered',
    relay(AlertTriggeredEventSchema, (payload) => ({ name: 'alert.triggered', payload })),
  );
  socket.on(
    'notification',
    relay(NotificationEventSchema, (payload) => ({ name: 'notification', payload })),
  );
  socket.on(
    'symbol.halted',
    relay(SymbolHaltedEventSchema, (payload) => ({ name: 'symbol.halted', payload })),
  );
  socket.on(
    'symbol.resumed',
    relay(SymbolResumedEventSchema, (payload) => ({ name: 'symbol.resumed', payload })),
  );
  socket.on(
    'trading.status',
    relay(TradingStatusEventSchema, (payload) => ({ name: 'trading.status', payload })),
  );

  return {
    connect() {
      clearTimeout(reconnectTimer);
      reconnectTimer = undefined;
      if (socket.connected || socket.active) return;
      setConnection({ status: 'connecting' });
      flushTimer ??= setInterval(flush, flushMs);
      socket.connect();
    },
    disconnect() {
      clearTimeout(reconnectTimer);
      reconnectTimer = undefined;
      socket.disconnect();
      clearInterval(flushTimer);
      flushTimer = undefined;
      buffer.clear();
    },
    acquire(symbols) {
      const unique = [...new Set(symbols)];
      for (const symbol of unique) refCounts.set(symbol, (refCounts.get(symbol) ?? 0) + 1);
      scheduleSync();
      return () => {
        for (const symbol of unique) {
          const count = (refCounts.get(symbol) ?? 1) - 1;
          if (count > 0) refCounts.set(symbol, count);
          else refCounts.delete(symbol);
        }
        scheduleSync();
      };
    },
    subscribedSymbols: () => [...subscribed],
    onTradingEvent(listener) {
      tradingListeners.add(listener);
      return () => {
        tradingListeners.delete(listener);
      };
    },
  };
}
