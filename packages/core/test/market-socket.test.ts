import { EventEmitter } from 'node:events';

import { type SubscribeAck } from '@sarwa/contracts';

import { createMarketSocket, type SocketAuthProvider } from '../src/market-socket';
import { createLiveStore } from '../src/store';
import { makeOrder } from './trading-fixtures';
import { makeQuote } from './utils';

class FakeSocket extends EventEmitter {
  connected = false;
  active = false;
  io = new EventEmitter();
  sent: { event: string; symbols: string[] }[] = [];
  rejectSubscribe = false;

  override emit(event: string, ...args: unknown[]): boolean {
    if (event === 'subscribe' || event === 'unsubscribe') {
      const { symbols } = args[0] as { symbols: string[] };
      this.sent.push({ event, symbols });
      const ack = args[1] as ((res: SubscribeAck) => void) | undefined;
      ack?.(
        this.rejectSubscribe
          ? { ok: false, error: { code: 'TOO_MANY_SYMBOLS', message: 'Too many' } }
          : { ok: true, quotes: symbols.map((symbol) => makeQuote({ symbol })) },
      );
      return true;
    }
    return super.emit(event, ...args);
  }

  connect() {
    this.active = true;
    this.connected = true;
    super.emit('connect');
  }

  disconnect() {
    this.connected = false;
    this.active = false;
    super.emit('disconnect', 'io client disconnect');
  }

  serverDrop() {
    this.connected = false;
    super.emit('disconnect', 'transport close');
  }

  serverKick() {
    this.connected = false;
    this.active = false;
    super.emit('disconnect', 'io server disconnect');
  }
}

const DEVICE_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

function setup(getDeviceId = () => Promise.resolve(DEVICE_ID)) {
  jest.useFakeTimers();
  const fake = new FakeSocket();
  const store = createLiveStore();
  let auth: SocketAuthProvider | undefined;
  const market = createMarketSocket({
    url: 'http://api',
    store,
    getDeviceId,
    createSocket: (_url, provider) => {
      auth = provider;
      return fake as never;
    },
  });
  const handshake = () =>
    new Promise((resolve) => {
      auth?.(resolve);
    });
  return { fake, store, market, handshake };
}

afterEach(() => {
  jest.useRealTimers();
});

describe('market socket', () => {
  it('uses WebSocket only unless the app asks for polling first', () => {
    const createSocket = jest.fn(() => new FakeSocket() as never);
    const options = {
      url: 'http://api',
      store: createLiveStore(),
      getDeviceId: () => Promise.resolve(DEVICE_ID),
      createSocket,
    };

    createMarketSocket(options);
    createMarketSocket({ ...options, transports: ['polling', 'websocket'] });

    expect(createSocket).toHaveBeenNthCalledWith(1, 'http://api/market', expect.any(Function), [
      'websocket',
    ]);
    expect(createSocket).toHaveBeenNthCalledWith(2, 'http://api/market', expect.any(Function), [
      'polling',
      'websocket',
    ]);
  });

  it('subscribes once per symbol, batched after a short delay', () => {
    const { fake, market } = setup();
    market.connect();

    market.acquire(['AAPL', 'TSLA']);
    market.acquire(['AAPL']);
    jest.advanceTimersByTime(200);

    expect(fake.sent).toEqual([{ event: 'subscribe', symbols: ['AAPL', 'TSLA'] }]);
  });

  it('subscribes in chunks the server accepts', () => {
    const { fake, market } = setup();
    market.connect();
    const symbols = Array.from({ length: 60 }, (_, i) => `S${String(i)}`);

    market.acquire(symbols);
    jest.advanceTimersByTime(200);

    expect(fake.sent.map((sent) => sent.symbols.length)).toEqual([50, 10]);
    expect(market.subscribedSymbols()).toHaveLength(60);
  });

  it('does not count symbols the server refused as subscribed, and retries them', () => {
    const { fake, market } = setup();
    market.connect();
    fake.rejectSubscribe = true;

    market.acquire(['AAPL']);
    jest.advanceTimersByTime(200);
    expect(market.subscribedSymbols()).toEqual([]);

    fake.rejectSubscribe = false;
    market.acquire(['TSLA']);
    jest.advanceTimersByTime(200);
    expect(fake.sent.at(-1)).toEqual({ event: 'subscribe', symbols: ['AAPL', 'TSLA'] });
    expect(market.subscribedSymbols()).toEqual(['AAPL', 'TSLA']);
  });

  it('unsubscribes only when the last user of a symbol releases it', () => {
    const { fake, market } = setup();
    market.connect();
    const releaseList = market.acquire(['AAPL', 'TSLA']);
    const releaseDetail = market.acquire(['AAPL']);
    jest.advanceTimersByTime(200);

    releaseList();
    jest.advanceTimersByTime(200);
    expect(fake.sent.at(-1)).toEqual({ event: 'unsubscribe', symbols: ['TSLA'] });

    releaseDetail();
    jest.advanceTimersByTime(200);
    expect(fake.sent.at(-1)).toEqual({ event: 'unsubscribe', symbols: ['AAPL'] });
  });

  it('applies the subscribe snapshot to the store', () => {
    const { market, store } = setup();
    market.connect();
    market.acquire(['NVDA']);
    jest.advanceTimersByTime(200);
    expect(store.getState().quotes.NVDA).toBeDefined();
  });

  it('buffers streamed quotes and flushes them to the store every 100 ms', () => {
    const { fake, market, store } = setup();
    market.connect();

    fake.emit('quotes', [makeQuote({ ts: 5, price: 1 })]);
    fake.emit('quotes', [makeQuote({ ts: 6, price: 2 })]);
    expect(store.getState().quotes.AAPL).toBeUndefined();

    jest.advanceTimersByTime(100);
    expect(store.getState().quotes.AAPL?.price).toBe(2);
  });

  it('ignores streamed quotes that fail validation', () => {
    const { fake, market, store } = setup();
    market.connect();

    fake.emit('quotes', [{ ...makeQuote(), price: -1 }]);
    jest.advanceTimersByTime(100);

    expect(store.getState().quotes.AAPL).toBeUndefined();
  });

  it('stores a valid market status and ignores a malformed one', () => {
    const { fake, market, store } = setup();
    market.connect();
    const status = { state: 'paused', volatility: 1, since: 10 };

    fake.emit('market:status', status);
    fake.emit('market:status', { state: 'exploded', volatility: 1, since: 11 });

    expect(store.getState().marketStatus).toEqual(status);
  });

  it('stores a valid remote config and ignores a malformed one', () => {
    const { fake, market, store } = setup();
    market.connect();
    const config = {
      maintenanceMode: true,
      banner: null,
      enabledPeriods: ['1D'],
      updatedAt: 5,
    };

    fake.emit('config:updated', config);
    fake.emit('config:updated', { ...config, enabledPeriods: [], updatedAt: 6 });

    expect(store.getState().appConfig).toEqual(config);
  });

  it('records when the server says the stock list changed and ignores bad payloads', () => {
    const { fake, market, store } = setup();
    market.connect();

    fake.emit('stocks:changed', { at: 42 });
    fake.emit('stocks:changed', { at: 'soon' });

    expect(store.getState().stocksChangedAt).toBe(42);
  });

  it('reports reconnecting and resubscribes everything on reconnect', () => {
    const { fake, market, store } = setup();
    market.connect();
    market.acquire(['AAPL', 'MSFT']);
    jest.advanceTimersByTime(200);

    fake.serverDrop();
    expect(store.getState().connection.status).toBe('reconnecting');

    fake.connect();
    expect(store.getState().connection.status).toBe('open');
    expect(fake.sent.at(-1)).toEqual({ event: 'subscribe', symbols: ['AAPL', 'MSFT'] });
  });

  it('reconnects and resubscribes by itself when the server kicks the client', () => {
    const { fake, market, store } = setup();
    market.connect();
    market.acquire(['AAPL', 'MSFT']);
    jest.advanceTimersByTime(200);
    const connect = jest.spyOn(fake, 'connect');

    fake.serverKick();
    expect(store.getState().connection.status).toBe('reconnecting');

    jest.advanceTimersByTime(1_000);
    expect(connect).toHaveBeenCalledTimes(1);
    expect(store.getState().connection.status).toBe('open');
    expect(fake.sent.at(-1)).toEqual({ event: 'subscribe', symbols: ['AAPL', 'MSFT'] });
  });

  it('does not reconnect after a kick when the app disconnects meanwhile', () => {
    const { fake, market, store } = setup();
    market.connect();
    const connect = jest.spyOn(fake, 'connect');

    fake.serverKick();
    market.disconnect();
    jest.advanceTimersByTime(1_000);

    expect(connect).not.toHaveBeenCalled();
    expect(store.getState().connection.status).toBe('offline');
  });

  it('connects only once when the app reconnects during the kick jitter', () => {
    const { fake, market } = setup();
    market.connect();
    const connect = jest.spyOn(fake, 'connect');

    fake.serverKick();
    market.connect();
    jest.advanceTimersByTime(1_000);

    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('goes offline on a manual disconnect', () => {
    const { market, store } = setup();
    market.connect();
    market.disconnect();
    expect(store.getState().connection.status).toBe('offline');
  });

  it('sends the device id in the handshake auth', async () => {
    const { handshake } = setup();

    await expect(handshake()).resolves.toEqual({ deviceId: DEVICE_ID });
  });

  it('sends an empty handshake when the device id cannot be read', async () => {
    const { handshake } = setup(() => Promise.reject(new Error('storage down')));

    await expect(handshake()).resolves.toEqual({});
  });
});

describe('market socket trading events', () => {
  it('passes a valid v1 event to every listener right away', () => {
    const { fake, market } = setup();
    const listener = jest.fn();
    market.onTradingEvent(listener);
    const payload = { v: 1, order: makeOrder() };

    fake.emit('order.updated', payload);

    expect(listener).toHaveBeenCalledWith({ name: 'order.updated', payload });
  });

  it('drops events that are malformed or of an unknown version', () => {
    const { fake, market } = setup();
    const listener = jest.fn();
    market.onTradingEvent(listener);

    fake.emit('order.updated', { v: 2, order: makeOrder() });
    fake.emit('order.updated', { v: 1, order: { ...makeOrder(), status: 'exploded' } });
    fake.emit('symbol.resumed', { v: 1, symbol: 'aapl', at: 1 });

    expect(listener).not.toHaveBeenCalled();
  });

  it('relays every trading event name', () => {
    const { fake, market } = setup();
    const names: string[] = [];
    market.onTradingEvent((event) => {
      names.push(event.name);
    });
    const halt = { symbol: 'AAPL', source: 'admin', message: 'News', since: 1, resumesAt: null };

    fake.emit('alert.triggered', {
      v: 1,
      alert: {
        id: 'al-1',
        symbol: 'AAPL',
        condition: 'price_above',
        thresholdTicks: 1,
        thresholdBps: null,
        repeat: 'once',
        enabled: true,
        armed: false,
        lastFiredAt: 1,
        createdAt: 1,
      },
      lastTicks: 2,
    });
    fake.emit('notification', {
      v: 1,
      notification: {
        id: 'n-1',
        payload: { kind: 'market_notice', message: 'Hi' },
        readAt: null,
        createdAt: 1,
      },
    });
    fake.emit('symbol.halted', { v: 1, halt });
    fake.emit('symbol.resumed', { v: 1, symbol: 'AAPL', at: 2 });

    expect(names).toEqual(['alert.triggered', 'notification', 'symbol.halted', 'symbol.resumed']);
  });

  it('stops calling a listener once it unsubscribes', () => {
    const { fake, market } = setup();
    const listener = jest.fn();
    const unsubscribe = market.onTradingEvent(listener);

    unsubscribe();
    fake.emit('order.updated', { v: 1, order: makeOrder() });

    expect(listener).not.toHaveBeenCalled();
  });
});
