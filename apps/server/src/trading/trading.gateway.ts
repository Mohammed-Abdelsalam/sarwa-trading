import { type OnGatewayInit, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { type Namespace, type Socket } from 'socket.io';

import {
  CUSTOMER_ACCESS_COOKIE,
  MARKET_NAMESPACE,
  type Notification,
  type SessionServerToClientEvents,
  SocketAuthSchema,
  type TradingServerToClientEvents,
} from '@sarwa/contracts';

import { CustomerMetrics } from '../auth/customer-metrics.service';
import { SessionsService } from '../auth/sessions.service';
import { readCookie } from '../common/cookies';
import { EventBus } from '../common/events';
import { env } from '../env';

const accountRoom = (accountId: string): string => `acct:${accountId}`;
const userRoom = (userId: string): string => `user:${userId}`;
const sessionRoom = (sessionId: string): string => `sess:${sessionId}`;

type Events = TradingServerToClientEvents & SessionServerToClientEvents;

// Shares the /market namespace with the quote stream. A signed-in socket (bearer token in the
// handshake, or the web's access cookie) joins its user, account and session rooms; guests get
// public events only.
@WebSocketGateway({
  namespace: MARKET_NAMESPACE,
  cors: { origin: env.CORS_ORIGINS, credentials: true },
})
export class TradingGateway implements OnGatewayInit {
  @WebSocketServer() private readonly server!: Namespace<object, Events>;

  constructor(
    events: EventBus,
    private readonly sessions: SessionsService,
    private readonly metrics: CustomerMetrics,
  ) {
    events.on('order.changed').subscribe(({ account, order }) => {
      this.toAccount(account.accountId).emit('order.updated', { v: 1, order });
    });
    events.on('alert.fired').subscribe(({ account, alert, lastTicks }) => {
      this.toAccount(account.accountId).emit('alert.triggered', { v: 1, alert, lastTicks });
    });
    events.on('account.reset').subscribe(({ account }) => {
      this.toAccount(account.accountId).emit('account.reset', { v: 1 });
    });
    events.on('trading.changed').subscribe(({ status }) => {
      this.server.emit('trading.status', { v: 1, status });
    });
    events.on('symbol.halted').subscribe(({ halt }) => {
      this.server.emit('symbol.halted', { v: 1, halt });
    });
    events.on('symbol.resumed').subscribe(({ symbol, at }) => {
      this.server.emit('symbol.resumed', { v: 1, symbol, at });
    });
    events.on('session.revoked').subscribe(({ sessionIds, reason, suspension }) => {
      if (sessionIds.length === 0) return;
      const rooms = sessionIds.map(sessionRoom);
      this.server
        .to(rooms)
        .emit('session.revoked', { v: 1, reason, ...(suspension && { suspension }) });
      this.server.in(rooms).disconnectSockets(true);
    });
  }

  // Runs before the connection is accepted, so a client's first event can't beat its rooms.
  afterInit(server: Namespace): void {
    server.use((socket: Socket, next) => {
      void this.admit(socket).finally(() => {
        next();
      });
    });
  }

  notification(accountId: string, notification: Notification): void {
    this.toAccount(accountId).emit('notification', { v: 1, notification });
  }

  private async admit(socket: Socket): Promise<void> {
    const auth = SocketAuthSchema.safeParse(socket.handshake.auth);
    const token =
      (auth.success ? auth.data.token : undefined) ??
      readCookie(socket.handshake.headers.cookie, CUSTOMER_ACCESS_COOKIE);
    if (token) {
      try {
        const { userId, accountId, sessionId } = await this.sessions.authenticate(token);
        await socket.join([userRoom(userId), accountRoom(accountId), sessionRoom(sessionId)]);
        return;
      } catch {
        // An expired or revoked token connects as a guest; the client refreshes and reconnects.
      }
    }
    if (auth.success)
      await this.metrics.recordGuestVisit(auth.data.deviceId).catch(() => undefined);
  }

  private toAccount(accountId: string) {
    return this.server.to(accountRoom(accountId));
  }
}
