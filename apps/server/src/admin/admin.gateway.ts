import { Logger } from '@nestjs/common';
import { type OnGatewayInit, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { type Namespace, type Socket } from 'socket.io';

import {
  ADMIN_NAMESPACE,
  ADMIN_SESSION_COOKIE,
  type AdminOrder,
  type AdminServerToClientEvents,
  type AdminTrading,
} from '@sarwa/contracts';

import { env } from '../env';
import { AdminSessions } from './auth';

function readCookie(header: string | undefined, name: string): string | undefined {
  for (const part of (header ?? '').split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return undefined;
}

// Live order flow and control changes for the dashboard; only a signed-in admin may connect.
@WebSocketGateway({
  namespace: ADMIN_NAMESPACE,
  cors: { origin: env.CORS_ORIGINS, credentials: true },
})
export class AdminGateway implements OnGatewayInit {
  @WebSocketServer() private readonly server!: Namespace<object, AdminServerToClientEvents>;

  private readonly logger = new Logger(AdminGateway.name);

  constructor(private readonly sessions: AdminSessions) {}

  afterInit(server: Namespace): void {
    server.use((socket: Socket, next) => {
      this.sessions
        .verify(readCookie(socket.handshake.headers.cookie, ADMIN_SESSION_COOKIE))
        .then(() => {
          next();
        })
        .catch(() => {
          this.logger.debug('Rejected an admin socket without a valid session');
          next(new Error('Unauthorized'));
        });
    });
  }

  order(order: AdminOrder): void {
    this.server.emit('admin.order', { v: 1, order });
  }

  trading(trading: AdminTrading): void {
    this.server.emit('admin.trading', { v: 1, trading });
  }
}
