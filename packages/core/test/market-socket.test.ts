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

  it('goes offline on a manual disconnect', () => {
    const { market, store } = setup();
    market.connect();
    market.disconnect();
    expect(store.getState().connection.status).toBe('offline');
  });
});
