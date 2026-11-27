import { type OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { type Namespace, type Socket } from 'socket.io';

import {
  type Halt,
  MARKET_NAMESPACE,
  type Notification,
  SocketAuthSchema,
  type TradingServerToClientEvents,
} from '@sarwa/contracts';

import { EventBus } from '../common/events';
import { env } from '../env';

const deviceRoom = (deviceId: string): string => `dev:${deviceId}`;

// Shares the /market namespace with the quote stream: private events go to the device's own room.
@WebSocketGateway({ namespace: MARKET_NAMESPACE, cors: { origin: env.CORS_ORIGINS } })
export class TradingGateway implements OnGatewayConnection {
  @WebSocketServer() private readonly server!: Namespace<object, TradingServerToClientEvents>;

  constructor(events: EventBus) {
    events.on('order.changed').subscribe(({ account, order }) => {
      this.toDevice(account.deviceId).emit('order.updated', { v: 1, order });
    });
    events.on('alert.fired').subscribe(({ account, alert, lastTicks }) => {
      this.toDevice(account.deviceId).emit('alert.triggered', { v: 1, alert, lastTicks });
    });
    events.on('account.reset').subscribe(({ account }) => {
      this.toDevice(account.deviceId).emit('account.reset', { v: 1 });
    });
    events.on('trading.changed').subscribe(({ status }) => {
      this.server.emit('trading.status', { v: 1, status });
    });
  }

  handleConnection(socket: Socket): void {
    const auth = SocketAuthSchema.safeParse(socket.handshake.auth);
    if (auth.success) void socket.join(deviceRoom(auth.data.deviceId));
  }

  notification(deviceId: string, notification: Notification): void {
    this.toDevice(deviceId).emit('notification', { v: 1, notification });
  }

  symbolHalted(halt: Halt): void {
    this.server.emit('symbol.halted', { v: 1, halt });
  }

  symbolResumed(symbol: string, at: number): void {
    this.server.emit('symbol.resumed', { v: 1, symbol, at });
  }

  private toDevice(deviceId: string) {
    return this.server.to(deviceRoom(deviceId));
  }
}
