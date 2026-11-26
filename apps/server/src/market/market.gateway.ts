import { Logger, type OnModuleDestroy } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayConnection,
  type OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { type Subscription } from 'rxjs';
import { type Namespace, type Socket } from 'socket.io';

import {
  type ClientToServerEvents,
  MARKET_NAMESPACE,
  MAX_SUBSCRIBE_SYMBOLS,
  type Quote,
  QUOTE_BATCH_MS,
  type ServerToClientEvents,
  type SubscribeAck,
  SubscribePayloadSchema,
} from '@sarwa/contracts';

import { AppConfigService } from '../app-config/app-config.service';
import { env } from '../env';
import { MarketService } from './market.service';

type MarketSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

const ROOM_PREFIX = 'sym:';
const room = (symbol: string): string => `${ROOM_PREFIX}${symbol}`;

@WebSocketGateway({ namespace: MARKET_NAMESPACE, cors: { origin: env.CORS_ORIGINS } })
export class MarketGateway implements OnGatewayInit, OnGatewayConnection, OnModuleDestroy {
  @WebSocketServer() private readonly server!: Namespace<
    ClientToServerEvents,
    ServerToClientEvents
  >;

  private readonly logger = new Logger(MarketGateway.name);
  private readonly pending = new Map<string, Quote>();
  private readonly subscriptions: Subscription[] = [];
  private flushTimer?: NodeJS.Timeout;

  constructor(
    private readonly market: MarketService,
    private readonly appConfig: AppConfigService,
  ) {}

  afterInit(): void {
    this.subscriptions.push(
      this.market.quotes$.subscribe((quotes) => {
        for (const quote of quotes) this.pending.set(quote.symbol, quote);
      }),
      this.market.status$.subscribe((status) => this.server.emit('market:status', status)),
      this.appConfig.changes$.subscribe((config) => this.server.emit('config:updated', config)),
    );
    this.flushTimer = setInterval(() => {
      this.flush();
    }, QUOTE_BATCH_MS);
  }

  onModuleDestroy(): void {
    clearInterval(this.flushTimer);
    for (const subscription of this.subscriptions) subscription.unsubscribe();
  }

  handleConnection(socket: MarketSocket): void {
    socket.emit('market:status', this.market.getStatus());
    socket.emit('config:updated', this.appConfig.get());
  }

  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @ConnectedSocket() socket: MarketSocket,
    @MessageBody() body: unknown,
  ): Promise<SubscribeAck> {
    const parsed = SubscribePayloadSchema.safeParse(body);
    if (!parsed.success) {
      return {
        ok: false,
        error: {
          code: 'INVALID_PAYLOAD',
          message: parsed.error.issues[0]?.message ?? 'Invalid payload',
        },
      };
    }

    const quotes = this.market.getQuotes([...new Set(parsed.data.symbols)]);
    const current = [...socket.rooms].filter((r) => r.startsWith(ROOM_PREFIX));
    const added = quotes.filter((q) => !socket.rooms.has(room(q.symbol)));
    if (current.length + added.length > MAX_SUBSCRIBE_SYMBOLS) {
      return {
        ok: false,
        error: {
          code: 'TOO_MANY_SYMBOLS',
          message: `At most ${MAX_SUBSCRIBE_SYMBOLS} symbols per connection`,
        },
      };
    }

    await socket.join(quotes.map((q) => room(q.symbol)));
    // The snapshot lets the UI render immediately instead of waiting for the next tick.
    return { ok: true, quotes };
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(@ConnectedSocket() socket: MarketSocket, @MessageBody() body: unknown): void {
    const parsed = SubscribePayloadSchema.safeParse(body);
    if (!parsed.success) return;
    for (const symbol of parsed.data.symbols) void socket.leave(room(symbol));
  }

  // One message per socket with the latest quote of each symbol it subscribed to.
  flush(): void {
    if (this.pending.size === 0) return;
    for (const socket of this.server.sockets.values()) {
      const batch: Quote[] = [];
      for (const r of socket.rooms) {
        const quote = r.startsWith(ROOM_PREFIX)
          ? this.pending.get(r.slice(ROOM_PREFIX.length))
          : undefined;
        if (quote) batch.push(quote);
      }
      if (batch.length > 0) socket.emit('quotes', batch);
    }
    this.pending.clear();
  }

  dropAll(): number {
    const count = this.server.sockets.size;
    this.server.disconnectSockets(true);
    this.logger.warn(`Dropped ${count} connections`);
    return count;
  }

  stats(): { connectedClients: number; activeSubscriptions: number } {
    let activeSubscriptions = 0;
    for (const socket of this.server.sockets.values()) {
      for (const r of socket.rooms) if (r.startsWith(ROOM_PREFIX)) activeSubscriptions++;
    }
    return { connectedClients: this.server.sockets.size, activeSubscriptions };
  }
}
