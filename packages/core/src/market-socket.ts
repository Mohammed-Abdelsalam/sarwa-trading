import { io, type Socket } from 'socket.io-client';
import { type z } from 'zod';

import {
  AccountResetEventSchema,
  AlertTriggeredEventSchema,
  AppConfigSchema,
  type ClientToServerEvents,
  MARKET_NAMESPACE,
  MarketStatusSchema,
  MAX_SUBSCRIBE_SYMBOLS,
  NotificationEventSchema,
  OrderUpdatedEventSchema,
  type Quote,
  QuotesEventSchema,
  type ServerToClientEvents,
  type SocketAuth,
  SocketEvent,
  StocksChangedEventSchema,
  SymbolHaltedEventSchema,
  SymbolResumedEventSchema,
  type TradingServerToClientEvents,
  TradingSocketEvent,
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
  // The admin dashboard passes ['polling', 'websocket'] because its Next rewrite can't proxy a WebSocket.
  transports?: SocketTransport[];
  createSocket?: (url: string, auth: SocketAuthProvider, transports: SocketTransport[]) => MarketIo;
}

export type SocketTransport = 'polling' | 'websocket';

export interface MarketSocket {
  connect(): void;
  disconnect(): void;
  acquire(symbols: string[]): () => void;
  subscribedSymbols(): string[];
  onTradingEvent(listener: TradingEventListener): () => void;
}

const defaultCreateSocket = (
  url: string,
  auth: SocketAuthProvider,
  transports: SocketTransport[],
): MarketIo =>
  io(url, {
    transports,
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
  transports = ['websocket'],
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
  const socket = createSocket(`${url.replace(/\/$/, '')}${MARKET_NAMESPACE}`, auth, transports);
  const tradingListeners = new Set<TradingEventListener>();
  const refCounts = new Map<string, number>();
  const subscribed = new Set<string>();
  const buffer = new Map<string, Quote>();
  let flushTimer: ReturnType<typeof setInterval> | undefined;
  let syncTimer: ReturnType<typeof setTimeout> | undefined;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  // Acks from an earlier connection must not touch the current subscriptions.
  let connections = 0;
  const setConnection = (connection: ConnectionState) => {
    store.getState().setConnection(connection);
  };

  // Socket events only fill a buffer; the store is updated at most every `flushMs`.
  const flush = () => {
    if (buffer.size === 0) return;
    store.getState().applyQuotes([...buffer.values()]);
    buffer.clear();
  };

  // A refused chunk leaves `subscribed`, so the next sync asks for it again.
  const subscribe = (symbols: string[]) => {
    const connection = connections;
    for (let i = 0; i < symbols.length; i += MAX_SUBSCRIBE_SYMBOLS) {
      const chunk = symbols.slice(i, i + MAX_SUBSCRIBE_SYMBOLS);
      for (const symbol of chunk) subscribed.add(symbol);
      socket.emit(SocketEvent.Subscribe, { symbols: chunk }, (ack) => {
        if (ack.ok) store.getState().applyQuotes(ack.quotes);
        else if (connection === connections) for (const symbol of chunk) subscribed.delete(symbol);
      });
    }
  };

  const sync = () => {
    syncTimer = undefined;
    if (!socket.connected) return;
    const wanted = [...refCounts.keys()];
    const removed = [...subscribed].filter((symbol) => !refCounts.has(symbol));
    if (removed.length > 0) {
      for (const symbol of removed) subscribed.delete(symbol);
      socket.emit(SocketEvent.Unsubscribe, { symbols: removed });
    }
    subscribe(wanted.filter((symbol) => !subscribed.has(symbol)));
  };

  const scheduleSync = () => {
    syncTimer ??= setTimeout(sync, syncDelayMs);
  };

  socket.on('connect', () => {
    connections += 1;
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
  socket.on(SocketEvent.Quotes, (payload) => {
    const parsed = QuotesEventSchema.safeParse(payload);
    if (!parsed.success) return;
    for (const quote of parsed.data) buffer.set(quote.symbol, quote);
  });
  socket.on(SocketEvent.MarketStatus, (payload) => {
    const parsed = MarketStatusSchema.safeParse(payload);
    if (parsed.success) store.getState().setMarketStatus(parsed.data);
  });
  socket.on(SocketEvent.ConfigUpdated, (payload) => {
    const parsed = AppConfigSchema.safeParse(payload);
    if (parsed.success) store.getState().setAppConfig(parsed.data);
  });
  socket.on(SocketEvent.StocksChanged, (payload) => {
    const parsed = StocksChangedEventSchema.safeParse(payload);
    if (parsed.success) store.getState().setStocksChangedAt(parsed.data.at);
  });

  // Each event is checked against its v1 schema; a shape this client doesn't know is dropped.
  const relay = <Name extends TradingEvent['name']>(
    name: Name,
    schema: z.ZodType<Extract<TradingEvent, { name: Name }>['payload']>,
  ) => {
    const forward = (payload: unknown) => {
      const parsed = schema.safeParse(payload);
      if (!parsed.success) return;
      const event = { name, payload: parsed.data } as TradingEvent;
      tradingListeners.forEach((listener) => {
        listener(event);
      });
    };
    socket.on(name, forward as never);
  };
  relay(TradingSocketEvent.OrderUpdated, OrderUpdatedEventSchema);
  relay(TradingSocketEvent.AlertTriggered, AlertTriggeredEventSchema);
  relay(TradingSocketEvent.Notification, NotificationEventSchema);
  relay(TradingSocketEvent.SymbolHalted, SymbolHaltedEventSchema);
  relay(TradingSocketEvent.SymbolResumed, SymbolResumedEventSchema);
  relay(TradingSocketEvent.TradingStatus, TradingStatusEventSchema);
  relay(TradingSocketEvent.AccountReset, AccountResetEventSchema);

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
