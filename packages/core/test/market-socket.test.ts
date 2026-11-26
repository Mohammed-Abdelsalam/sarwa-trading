import { EventEmitter } from 'node:events';

import { type SubscribeAck } from '@sarwa/contracts';

import { createMarketSocket } from '../src/market-socket';
import { createLiveStore } from '../src/store';
import { makeQuote } from './utils';

class FakeSocket extends EventEmitter {
  connected = false;
  active = false;
  io = new EventEmitter();
  sent: { event: string; symbols: string[] }[] = [];

  override emit(event: string, ...args: unknown[]): boolean {
    if (event === 'subscribe' || event === 'unsubscribe') {
      const { symbols } = args[0] as { symbols: string[] };
      this.sent.push({ event, symbols });
      const ack = args[1] as ((res: SubscribeAck) => void) | undefined;
      ack?.({ ok: true, quotes: symbols.map((symbol) => makeQuote({ symbol })) });
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

function setup() {
  jest.useFakeTimers();
  const fake = new FakeSocket();
  const store = createLiveStore();
  const market = createMarketSocket({
    url: 'http://api',
    store,
    createSocket: () => fake as never,
  });
  return { fake, store, market };
}

afterEach(() => {
  jest.useRealTimers();
});

describe('market socket', () => {
  it('subscribes once per symbol, batched after a short delay', () => {
    const { fake, market } = setup();
    market.connect();

    market.acquire(['AAPL', 'TSLA']);
    market.acquire(['AAPL']);
    jest.advanceTimersByTime(200);

    expect(fake.sent).toEqual([{ event: 'subscribe', symbols: ['AAPL', 'TSLA'] }]);
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
});
