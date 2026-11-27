import { Logger } from '@nestjs/common';
import { type OnGatewayInit, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { type Namespace, type Socket } from 'socket.io';

import {
  ADMIN_NAMESPACE,
  ADMIN_SESSION_COOKIE,
  type AdminServerToClientEvents,
} from '@sarwa/contracts';

import { EventBus } from '../common/events';
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

  constructor(
    private readonly sessions: AdminSessions,
    events: EventBus,
  ) {
    events.on('order.changed').subscribe(({ account, order, latencyMs }) => {
      this.server.emit('admin.order', {
        v: 1,
        order: { ...order, accountHandle: account.handle, latencyMs },
      });
    });
    events.on('trading.changed').subscribe(({ admin }) => {
      this.server.emit('admin.trading', { v: 1, trading: admin });
    });
  }

  afterInit(server: Namespace): void {
    server.use((socket: Socket, next) => {
      this.sessions
        .verify(readCookie(socket.handshake.headers.cookie, ADMIN_SESSION_COOKIE))
        .then(async (admin) => {
          await socket.join(adminRoom(admin.id));
          next();
        })
        .catch(() => {
          this.logger.debug('Rejected an admin socket without a valid session');
          next(new Error('Unauthorized'));
        });
    });
  }

  // The session is only checked at connect, so a disabled or re-roled admin is dropped here.
  dropAdmin(adminId: string): void {
    this.server.in(adminRoom(adminId)).disconnectSockets(true);
  }
}

const adminRoom = (adminId: string) => `admin:${adminId}`;
