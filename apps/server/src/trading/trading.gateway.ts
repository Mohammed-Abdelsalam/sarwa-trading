import { type OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { type Namespace, type Socket } from 'socket.io';

import {
  type Alert,
  type Halt,
  MARKET_NAMESPACE,
  type Notification,
  type Order,
  SocketAuthSchema,
  type TradingServerToClientEvents,
  type TradingStatus,
} from '@sarwa/contracts';

import { env } from '../env';

const deviceRoom = (deviceId: string): string => `dev:${deviceId}`;

// Shares the /market namespace with the quote stream: private events go to the device's own room.
@WebSocketGateway({ namespace: MARKET_NAMESPACE, cors: { origin: env.CORS_ORIGINS } })
export class TradingGateway implements OnGatewayConnection {
  @WebSocketServer() private readonly server!: Namespace<object, TradingServerToClientEvents>;

  handleConnection(socket: Socket): void {
    const auth = SocketAuthSchema.safeParse(socket.handshake.auth);
    if (auth.success) void socket.join(deviceRoom(auth.data.deviceId));
  }

  orderUpdated(deviceId: string, order: Order): void {
    this.server.to(deviceRoom(deviceId)).emit('order.updated', { v: 1, order });
  }

  alertTriggered(deviceId: string, alert: Alert, lastTicks: number): void {
    this.server.to(deviceRoom(deviceId)).emit('alert.triggered', { v: 1, alert, lastTicks });
  }

  notification(deviceId: string, notification: Notification): void {
    this.server.to(deviceRoom(deviceId)).emit('notification', { v: 1, notification });
  }

  symbolHalted(halt: Halt): void {
    this.server.emit('symbol.halted', { v: 1, halt });
  }

  symbolResumed(symbol: string, at: number): void {
    this.server.emit('symbol.resumed', { v: 1, symbol, at });
  }

  tradingStatus(status: TradingStatus): void {
    this.server.emit('trading.status', { v: 1, status });
  }
}
