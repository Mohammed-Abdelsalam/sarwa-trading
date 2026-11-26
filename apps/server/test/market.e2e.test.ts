import { type INestApplication } from '@nestjs/common';
import { io, type Socket } from 'socket.io-client';

import {
  type ClientToServerEvents,
  MARKET_NAMESPACE,
  type Quote,
  type ServerToClientEvents,
  type SubscribeAck,
  SubscribeAckSchema,
} from '@sarwa/contracts';

import { startApp } from './app';

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let app: INestApplication;
let url: string;
let socket: ClientSocket;

beforeAll(async () => {
  ({ app, url } = await startApp());
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  socket = io(`${url}${MARKET_NAMESPACE}`, { transports: ['websocket'], forceNew: true });
  await new Promise<void>((resolve) => socket.once('connect', resolve));
});

afterEach(() => {
  socket.disconnect();
});

const subscribe = (symbols: string[]) =>
  new Promise<SubscribeAck>((resolve) => {
    socket.emit('subscribe', { symbols }, resolve);
  });

describe('market socket', () => {
  it('acks a subscription with a snapshot of the current quotes', async () => {
    const ack = SubscribeAckSchema.parse(await subscribe(['AAPL', 'TSLA', 'ZZZZ']));
    expect(ack.ok && ack.quotes.map((q) => q.symbol).sort()).toEqual(['AAPL', 'TSLA']);
  });

  it('streams batched quotes only for subscribed symbols', async () => {
    await subscribe(['AAPL', 'NVDA', 'TSLA', 'MSFT', 'META']);
    const received: Quote[] = [];
    await new Promise<void>((resolve) => {
      socket.on('quotes', (quotes) => {
        received.push(...quotes);
        if (received.length >= 5) resolve();
      });
    });
    const allowed = new Set(['AAPL', 'NVDA', 'TSLA', 'MSFT', 'META']);
    expect(received.every((q) => allowed.has(q.symbol))).toBe(true);
  });

  it('rejects more than 50 symbols', async () => {
    const symbols = Array.from(
      { length: 51 },
      (_, i) =>
        `S${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + Math.floor(i / 26))}`,
    );
    const ack = await subscribe(symbols);
    expect(ack.ok).toBe(false);
  });

  it('sends the market status and app config on connect', async () => {
    const fresh: ClientSocket = io(`${url}${MARKET_NAMESPACE}`, {
      transports: ['websocket'],
      forceNew: true,
    });
    const [status, config] = await Promise.all([
      new Promise((resolve) => fresh.once('market:status', resolve)),
      new Promise((resolve) => fresh.once('config:updated', resolve)),
    ]);
    fresh.disconnect();
    expect(status).toMatchObject({ state: 'running' });
    expect(config).toMatchObject({ maintenanceMode: false });
  });
});
